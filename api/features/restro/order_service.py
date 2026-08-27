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
    KHATA_SETTLEMENT_METHODS,
    DISCOUNT_TYPES,
)
from features.restro.table_repository import TableRepository
from features.restro.menu_item_repository import MenuItemRepository
from features.restro.menu_item_service import combo_note_from_components
from features.restro.customer_repository import CustomerRepository
from features.restro.khata_settlement_repository import KhataSettlementRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


def compute_order_total(order, vat_enabled: bool, vat_rate: Decimal) -> Decimal:
    """Mirrors the frontend billTotals(): subtotal from non-voided lines,
    discount (percent or flat), then VAT applied to the taxable amount.
    Used server-side both for reports and for the khata outstanding-balance
    calculation, so the number always matches what the customer was shown at
    bill time.

    vat_enabled/vat_rate must come from that order's own branch's
    RestroBranchSettings (see BranchSettingsService.get_or_create) — never a
    hardcoded default. A tenant that isn't VAT-registered must never have VAT
    silently added to a reported/reconciled total."""
    subtotal = sum(
        (Decimal(line.price) * line.qty for line in order.lines if not line.is_voided),
        Decimal("0"),
    )
    if order.discount_type == "percent":
        discount = subtotal * Decimal(order.discount_value) / Decimal("100")
    else:
        discount = Decimal(order.discount_value)
    taxable = max(Decimal("0"), subtotal - discount)
    vat = (taxable * vat_rate / Decimal("100")) if vat_enabled else Decimal("0")
    return (taxable + vat).quantize(Decimal("0.01"))


def sum_order_totals(db: Session, tenant_id: str, orders: list) -> Decimal:
    """compute_order_total() summed across a list of orders, resolving each
    order's own branch's VAT settings — batched to one settings lookup per
    distinct branch_id in the list (not one per order), since in practice a
    customer's orders all share one branch but nothing here assumes that."""
    from features.restro.branch_settings_service import BranchSettingsService

    settings_by_branch: dict[str, tuple[bool, Decimal]] = {}
    total = Decimal("0")
    for order in orders:
        if order.branch_id not in settings_by_branch:
            result = BranchSettingsService.get_or_create(db, tenant_id, order.branch_id)
            settings = result.get("settings")
            settings_by_branch[order.branch_id] = (
                (bool(settings.vat_enabled), Decimal(settings.vat_rate))
                if result["success"]
                else (False, Decimal("0"))
            )
        vat_enabled, vat_rate = settings_by_branch[order.branch_id]
        total += compute_order_total(order, vat_enabled, vat_rate)
    return total


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
    def list_paginated(
        db: Session,
        tenant_id: str,
        branch_id: str,
        status: str | None = None,
        type: str | None = None,
        kitchen_status: str | None = None,
        table_id: str | None = None,
        payment_method: str | None = None,
        bs_from: str | None = None,
        bs_to: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> dict:
        if not OrderService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        items, total = OrderRepository.list_paginated(
            db,
            tenant_id=tenant_id,
            branch_id=branch_id,
            status=status,
            type=type,
            kitchen_status=kitchen_status,
            table_id=table_id,
            payment_method=payment_method,
            bs_from=bs_from,
            bs_to=bs_to,
            search=search,
            offset=offset,
            limit=limit,
        )
        return {"success": True, "orders": items, "total": total}

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
        customer_id: str | None = None,
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
            # Delivery: customer_id is required (holds name/phone/address on
            # the customer row). Dine-in can also carry customer_id for repeat
            # walk-ins, but it's optional.
            if not customer_id:
                return {"success": False, "error_code": "CUSTOMER_REQUIRED"}

        # If customer_id is supplied for any type, validate it belongs to
        # this tenant+branch. Skip validation entirely when None (dine-in walk-in).
        if customer_id:
            customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
            if not customer or customer.branch_id != branch_id or not customer.is_active:
                return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}

        try:
            order = OrderRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                type=type,
                table_id=primary_table_id,
                customer_id=customer_id,
                waiter_name=waiter_name,
                waiter_cred_id=waiter_cred_id,
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
            # For combos, auto-populate the line note with the composition so
            # the KOT shows the kitchen what to actually prep. Doesn't
            # override an explicit note the waiter typed.
            if item.is_combo and not (note and note.strip()):
                note = combo_note_from_components(item)
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
        customer_id: str | None = None,
    ) -> dict:
        if payment_method not in PAYMENT_METHODS:
            return {"success": False, "error_code": "INVALID_PAYMENT_METHOD"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}

        # Khata rule: customer required. Either supplied inline here (waiter
        # picked/created at pay time) or already attached at order creation
        # (delivery flow). If neither, refuse.
        effective_customer_id = customer_id or order.customer_id
        if payment_method == "khata":
            if not effective_customer_id:
                return {"success": False, "error_code": "CUSTOMER_REQUIRED_FOR_KHATA"}
            customer = CustomerRepository.get_by_id(db, tenant_id, effective_customer_id)
            if not customer or customer.branch_id != branch_id or not customer.is_active:
                return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}

        now = datetime.now(timezone.utc)
        # For cash/qr the money's in — settled_at = paid_at, so the customer
        # never accrues a balance. For khata we deliberately leave settled_at
        # NULL until the customer pays down their tab via /settle-khata.
        settled_at_value = None if payment_method == "khata" else now
        clear_settled = payment_method == "khata"

        # Auto-finish the kitchen ticket. Paying = the customer got the food,
        # so the kitchen has no more work to do on it. Prevents a paid order
        # from lingering on the Kitchen Display board in "new"/"cooking"
        # forever (chef can't advance it — status='paid' makes it
        # non-editable — and shops that don't use the kitchen board at all
        # would never touch kitchen_status manually). Kitchen board also
        # filters status='draft' as belt-and-suspenders.
        kitchen_status = "served" if order.kitchen_status != "served" else None
        updated = OrderRepository.set_status(
            db,
            order,
            status="paid",
            kitchen_status=kitchen_status,
            paid_at=now,
            payment_method=payment_method,
            customer_id=effective_customer_id if payment_method == "khata" else None,
            settled_at=settled_at_value,
            clear_settled_at=clear_settled,
        )
        # Free the dine-in table (whole merge group).
        if order.type == "dine-in" and order.table_id:
            OrderService._set_group_status(db, tenant_id, order.table_id, "empty")
        logger.info(
            f"Order paid: {order.id} via {payment_method}",
            extra={"tenant_id": tenant_id, "customer_id": effective_customer_id},
        )
        return {"success": True, "order": updated}

    @staticmethod
    def set_customer(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        customer_id: str | None,
    ) -> dict:
        """Attach or clear a customer on a draft order — mostly used to tag a
        dine-in order to a khata customer before payment, so the waiter can
        write the customer's name on the receipt (and mark-paid can skip the
        customer picker). Only editable while the order is still draft."""
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        if customer_id:
            customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
            if not customer or customer.branch_id != branch_id or not customer.is_active:
                return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}
        # Direct assign — no set_status call because customer_id is
        # legitimately mutable while draft and we don't want the other
        # side-effects (kitchen_status auto-flip etc.) that set_status has.
        order.customer_id = customer_id
        db.commit()
        db.refresh(order)
        return {"success": True, "order": order}

    @staticmethod
    def khata_orders_total(db: Session, tenant_id: str, customer_id: str) -> Decimal:
        """Sum of every khata order total for a customer (the debit side of
        the ledger). Does NOT subtract settlements — that's the caller's job
        via outstanding_balance()."""
        orders = OrderRepository.list_khata_orders_for_customer(db, tenant_id, customer_id)
        return sum_order_totals(db, tenant_id, orders)

    @staticmethod
    def outstanding_balance(db: Session, tenant_id: str, customer_id: str) -> Decimal:
        """Live khata balance = SUM(khata order totals) − SUM(settlements).
        Never negative — a customer who over-paid shows 0 (over-payment
        would need a proper credit-note flow we're not modeling yet)."""
        debits = OrderService.khata_orders_total(db, tenant_id, customer_id)
        credits = KhataSettlementRepository.total_for_customer(db, tenant_id, customer_id)
        return max(Decimal("0"), debits - credits)

    @staticmethod
    def record_khata_settlement(
        db: Session,
        tenant_id: str,
        branch_id: str,
        customer_id: str,
        amount: Decimal,
        method: str,
        note: str | None,
        actor_name: str,
        actor_cred_id: str | None,
    ) -> dict:
        """Records a partial or full payment against a customer's khata
        balance. Amount must be > 0 and not exceed the current outstanding
        balance (server-side clamp — the UI can pre-fill "full amount" but
        can't accept an overpayment through this path)."""
        if method not in KHATA_SETTLEMENT_METHODS:
            return {"success": False, "error_code": "INVALID_SETTLEMENT_METHOD"}
        if amount <= 0:
            return {"success": False, "error_code": "INVALID_AMOUNT"}
        customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
        if not customer or customer.branch_id != branch_id or not customer.is_active:
            return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}

        balance = OrderService.outstanding_balance(db, tenant_id, customer_id)
        if balance <= 0:
            return {"success": False, "error_code": "NO_BALANCE_TO_SETTLE"}
        if amount > balance:
            return {"success": False, "error_code": "AMOUNT_EXCEEDS_BALANCE"}

        settlement = KhataSettlementRepository.create(
            db,
            tenant_id=tenant_id,
            branch_id=branch_id,
            customer_id=customer_id,
            amount=amount,
            method=method,
            note=note,
            actor_name=actor_name,
            actor_cred_id=actor_cred_id,
        )
        new_balance = OrderService.outstanding_balance(db, tenant_id, customer_id)
        logger.info(
            f"Khata settlement: customer={customer_id} amount={amount} via {method} → balance {new_balance}",
            extra={"tenant_id": tenant_id, "branch_id": branch_id},
        )
        return {
            "success": True,
            "settlement": settlement,
            "new_balance": new_balance,
        }

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
