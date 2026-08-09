from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.order_repository import (
    OrderRepository,
    ORDER_TYPES,
    ORDER_STATUSES,
    KITCHEN_STATUSES,
    DELIVERY_STATUSES,
    PAYMENT_METHODS,
    DISCOUNT_TYPES,
)
from features.restro.table_repository import TableRepository
from features.restro.menu_item_repository import MenuItemRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


class OrderService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    @staticmethod
    def list_for_branch(
        db: Session,
        tenant_id: str,
        branch_id: str,
        status: str | None = None,
        type: str | None = None,
        kitchen_status: str | None = None,
        table_id: str | None = None,
        limit: int | None = None,
    ) -> dict:
        if not OrderService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        orders = OrderRepository.list_for_branch(
            db,
            tenant_id=tenant_id,
            branch_id=branch_id,
            status=status,
            type=type,
            kitchen_status=kitchen_status,
            table_id=table_id,
            limit=limit,
        )
        return {"success": True, "orders": orders}

    @staticmethod
    def get(db: Session, tenant_id: str, branch_id: str, order_id: str) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        return {"success": True, "order": order}

    @staticmethod
    def get_draft_for_table(
        db: Session, tenant_id: str, branch_id: str, table_id: str
    ) -> dict:
        table = TableRepository.get_by_id(db, tenant_id, table_id)
        if not table or table.branch_id != branch_id or not table.is_active:
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}
        ids = OrderRepository.merge_group_ids(db, tenant_id, table_id)
        order = OrderRepository.get_draft_for_tables(db, tenant_id, ids)
        return {"success": True, "order": order}  # order may be None

    # ------------------------------------------------------------------
    # Create draft order
    # ------------------------------------------------------------------

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        type: str,
        waiter_name: str,
        waiter_cred_id: str | None,
        table_id: str | None = None,
        delivery_customer_name: str | None = None,
        delivery_phone: str | None = None,
        delivery_address: str | None = None,
    ) -> dict:
        if not OrderService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if type not in ORDER_TYPES:
            return {"success": False, "error_code": "INVALID_TYPE"}

        primary_table_id: str | None = None
        if type == "dine-in":
            if not table_id:
                return {"success": False, "error_code": "TABLE_REQUIRED"}
            table = TableRepository.get_by_id(db, tenant_id, table_id)
            if not table or table.branch_id != branch_id or not table.is_active:
                return {"success": False, "error_code": "TABLE_NOT_FOUND"}
            # If this table is in a merge group, the primary table is the one
            # already holding a draft (if any); otherwise the first in the
            # group by created_at. Keeps "one draft per merge group" invariant.
            ids = OrderRepository.merge_group_ids(db, tenant_id, table_id)
            existing = OrderRepository.get_draft_for_tables(db, tenant_id, ids)
            if existing:
                return {"success": False, "error_code": "TABLE_ALREADY_HAS_DRAFT"}
            primary_table_id = table_id  # caller's chosen table is fine
        else:
            # delivery
            if not (delivery_customer_name and delivery_phone and delivery_address):
                return {"success": False, "error_code": "DELIVERY_INFO_REQUIRED"}

        try:
            order = OrderRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                type=type,
                table_id=primary_table_id,
                waiter_name=waiter_name,
                waiter_cred_id=waiter_cred_id,
                delivery_customer_name=delivery_customer_name,
                delivery_phone=delivery_phone,
                delivery_address=delivery_address,
            )
            logger.info(
                f"Order created: {order.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "type": type},
            )
            return {"success": True, "order": order}
        except IntegrityError:
            db.rollback()
            # Partial unique on (table_id) WHERE status='draft' AND type='dine-in'
            # caught a race with another simultaneous open.
            return {"success": False, "error_code": "TABLE_ALREADY_HAS_DRAFT"}
        except Exception as e:
            db.rollback()
            logger.error(f"Order creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    # ------------------------------------------------------------------
    # Lines
    # ------------------------------------------------------------------

    @staticmethod
    def add_line(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        menu_item_id: str | None,
        name: str | None,
        price: Decimal | None,
        qty: int,
        note: str | None,
        variant_name: str | None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        if qty < 1:
            return {"success": False, "error_code": "INVALID_QTY"}

        snapshot_name = name
        snapshot_price = price

        # If a menu_item_id is given, snapshot from the menu item — protects
        # against the client sending stale/manipulated prices.
        if menu_item_id:
            item = MenuItemRepository.get_by_id(db, tenant_id, menu_item_id)
            if not item or item.branch_id != branch_id or not item.is_active:
                return {"success": False, "error_code": "MENU_ITEM_NOT_FOUND"}
            if item.sold_out:
                return {"success": False, "error_code": "ITEM_SOLD_OUT"}
            snapshot_name = item.name
            if item.has_variants:
                if not variant_name:
                    return {"success": False, "error_code": "VARIANT_REQUIRED"}
                variant = next(
                    (v for v in item.variants if v.name == variant_name), None
                )
                if not variant:
                    return {"success": False, "error_code": "VARIANT_NOT_FOUND"}
                snapshot_price = Decimal(variant.price)
            else:
                snapshot_price = Decimal(item.price) if item.price is not None else Decimal(0)
        else:
            # Custom line (e.g. an off-menu item) — client must provide name+price.
            if not snapshot_name or snapshot_price is None:
                return {"success": False, "error_code": "NAME_AND_PRICE_REQUIRED"}

        if snapshot_price is None or snapshot_price < 0:
            return {"success": False, "error_code": "INVALID_PRICE"}

        try:
            # Same-item stacking: if an unsent line for the same menu_item +
            # variant exists, bump its qty instead of creating a duplicate row.
            existing = OrderRepository.find_unsent_matching_line(
                db, order_id, menu_item_id, variant_name
            )
            if existing:
                line = OrderRepository.update_line(db, existing, qty=existing.qty + qty)
            else:
                line = OrderRepository.create_line(
                    db,
                    order_id=order_id,
                    menu_item_id=menu_item_id,
                    name=snapshot_name,
                    variant_name=variant_name,
                    price=Decimal(snapshot_price),
                    qty=qty,
                    note=(note.strip() if note else None),
                )
        except Exception as e:
            db.rollback()
            logger.error(f"Add line failed: {str(e)}")
            return {"success": False, "error_code": "LINE_ADD_FAILED"}

        # Side effect: first line on a dine-in order flips table to occupied.
        if order.type == "dine-in" and order.table_id:
            OrderService._set_group_status(db, tenant_id, order.table_id, "occupied")

        return {"success": True, "order": OrderRepository.get_by_id(db, tenant_id, order_id), "line": line}

    @staticmethod
    def update_line(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        line_id: str,
        qty: int | None = None,
        note: str | None = None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        line = OrderRepository.get_line_by_id(db, order_id, line_id)
        if not line or line.is_voided:
            return {"success": False, "error_code": "LINE_NOT_FOUND"}
        if qty is not None and qty < 1:
            return {"success": False, "error_code": "INVALID_QTY"}
        updated = OrderRepository.update_line(db, line, qty=qty, note=note)
        return {"success": True, "line": updated}

    @staticmethod
    def void_line(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        line_id: str,
        reason: str | None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        line = OrderRepository.get_line_by_id(db, order_id, line_id)
        if not line or line.is_voided:
            return {"success": False, "error_code": "LINE_NOT_FOUND"}
        voided = OrderRepository.mark_line_voided(db, line, reason)
        return {"success": True, "line": voided}

    @staticmethod
    def delete_line(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        line_id: str,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        line = OrderRepository.get_line_by_id(db, order_id, line_id)
        if not line:
            return {"success": False, "error_code": "LINE_NOT_FOUND"}
        # Once sent to kitchen, you can't hard-delete — you void with a reason
        # so the audit trail survives.
        if line.sent:
            return {"success": False, "error_code": "CANNOT_DELETE_SENT_LINE"}
        OrderRepository.delete_line(db, line)
        return {"success": True}

    # ------------------------------------------------------------------
    # Workflow transitions
    # ------------------------------------------------------------------

    @staticmethod
    def send_to_kitchen(
        db: Session, tenant_id: str, branch_id: str, order_id: str
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        marked = OrderRepository.mark_all_unsent_as_sent(db, order_id)
        # Bump placed_at so the kitchen "time since order" clock resets for a
        # follow-up round, and reset kitchen_status if it was already served.
        if marked > 0:
            OrderRepository.bump_placed_at(db, order)
        if order.kitchen_status == "served":
            OrderRepository.set_status(db, order, kitchen_status="new")
        return {"success": True, "order": order, "marked": marked}

    @staticmethod
    def set_kitchen_status(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        kitchen_status: str,
    ) -> dict:
        if kitchen_status not in KITCHEN_STATUSES:
            return {"success": False, "error_code": "INVALID_KITCHEN_STATUS"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        updated = OrderRepository.set_status(db, order, kitchen_status=kitchen_status)
        return {"success": True, "order": updated}

    @staticmethod
    def set_discount(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        discount_type: str,
        discount_value: Decimal,
    ) -> dict:
        if discount_type not in DISCOUNT_TYPES:
            return {"success": False, "error_code": "INVALID_DISCOUNT_TYPE"}
        if discount_value < 0:
            return {"success": False, "error_code": "INVALID_DISCOUNT_VALUE"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        updated = OrderRepository.set_discount(db, order, discount_type, Decimal(discount_value))
        return {"success": True, "order": updated}

    @staticmethod
    def mark_paid(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        payment_method: str,
    ) -> dict:
        if payment_method not in PAYMENT_METHODS:
            return {"success": False, "error_code": "INVALID_PAYMENT_METHOD"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        updated = OrderRepository.set_status(
            db,
            order,
            status="paid",
            paid_at=datetime.now(timezone.utc),
            payment_method=payment_method,
        )
        # Free the dine-in table (whole merge group).
        if order.type == "dine-in" and order.table_id:
            OrderService._set_group_status(db, tenant_id, order.table_id, "empty")
        logger.info(f"Order paid: {order.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "order": updated}

    @staticmethod
    def cancel(db: Session, tenant_id: str, branch_id: str, order_id: str) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        updated = OrderRepository.set_status(db, order, status="cancelled")
        if order.type == "dine-in" and order.table_id:
            OrderService._set_group_status(db, tenant_id, order.table_id, "empty")
        logger.info(f"Order cancelled: {order.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "order": updated}

    @staticmethod
    def set_delivery_status(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        delivery_status: str,
    ) -> dict:
        if delivery_status not in DELIVERY_STATUSES:
            return {"success": False, "error_code": "INVALID_DELIVERY_STATUS"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.type != "delivery":
            return {"success": False, "error_code": "NOT_A_DELIVERY_ORDER"}
        updated = OrderRepository.set_delivery_status(db, order, delivery_status)
        return {"success": True, "order": updated}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _set_group_status(
        db: Session, tenant_id: str, table_id: str, status: str
    ) -> None:
        """Flip the status of a table AND every other table in its merge
        group. Matches the frontend's setTableStatus behavior."""
        ids = OrderRepository.merge_group_ids(db, tenant_id, table_id)
        tables = TableRepository.get_many_by_ids(db, tenant_id, ids)
        for t in tables:
            t.status = status
        db.commit()
