from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import and_
from sqlalchemy.orm import Session
from shared_models import RestroOrder, RestroOrderLine, RestroTable


ORDER_TYPES = {"dine-in", "delivery"}
ORDER_STATUSES = {"draft", "paid", "cancelled"}
KITCHEN_STATUSES = {"new", "cooking", "ready", "served"}
DELIVERY_STATUSES = {"pending", "out", "delivered"}
PAYMENT_METHODS = {"cash", "qr", "card"}
DISCOUNT_TYPES = {"percent", "flat"}


class OrderRepository:
    # ------------------------------------------------------------------
    # Orders
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
    ) -> RestroOrder:
        order = RestroOrder(
            tenant_id=tenant_id,
            branch_id=branch_id,
            type=type,
            status="draft",
            kitchen_status="new",
            table_id=table_id,
            waiter_name=waiter_name,
            waiter_cred_id=waiter_cred_id,
            delivery_customer_name=delivery_customer_name,
            delivery_phone=delivery_phone,
            delivery_address=delivery_address,
            delivery_status="pending" if type == "delivery" else None,
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, order_id: str) -> RestroOrder | None:
        return (
            db.query(RestroOrder)
            .filter(RestroOrder.id == order_id, RestroOrder.tenant_id == tenant_id)
            .first()
        )

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
    ) -> list[RestroOrder]:
        q = db.query(RestroOrder).filter(
            RestroOrder.tenant_id == tenant_id,
            RestroOrder.branch_id == branch_id,
        )
        if status:
            q = q.filter(RestroOrder.status == status)
        if type:
            q = q.filter(RestroOrder.type == type)
        if kitchen_status:
            q = q.filter(RestroOrder.kitchen_status == kitchen_status)
        if table_id:
            q = q.filter(RestroOrder.table_id == table_id)
        q = q.order_by(RestroOrder.placed_at.desc())
        if limit:
            q = q.limit(limit)
        return q.all()

    @staticmethod
    def get_draft_for_tables(
        db: Session, tenant_id: str, table_ids: list[str]
    ) -> RestroOrder | None:
        """Given a set of table IDs (e.g. a merge group), return the single
        draft dine-in order that belongs to any of them, or None."""
        if not table_ids:
            return None
        return (
            db.query(RestroOrder)
            .filter(
                RestroOrder.tenant_id == tenant_id,
                RestroOrder.table_id.in_(table_ids),
                RestroOrder.status == "draft",
                RestroOrder.type == "dine-in",
            )
            .first()
        )

    @staticmethod
    def merge_group_ids(
        db: Session, tenant_id: str, table_id: str
    ) -> list[str]:
        """Walk the merge group for the given table: if it's part of a merge
        group, return every table id in the group; otherwise just [table_id].
        Used by get_draft_for_table."""
        table = (
            db.query(RestroTable)
            .filter(RestroTable.id == table_id, RestroTable.tenant_id == tenant_id)
            .first()
        )
        if not table or not table.merge_id:
            return [table_id]
        rows = (
            db.query(RestroTable.id)
            .filter(
                RestroTable.tenant_id == tenant_id,
                RestroTable.merge_id == table.merge_id,
                RestroTable.is_active == True,
            )
            .all()
        )
        return [r[0] for r in rows]

    @staticmethod
    def set_status(
        db: Session,
        order: RestroOrder,
        status: str | None = None,
        kitchen_status: str | None = None,
        paid_at: datetime | None = None,
        payment_method: str | None = None,
    ) -> RestroOrder:
        if status is not None:
            order.status = status
        if kitchen_status is not None:
            order.kitchen_status = kitchen_status
        if paid_at is not None:
            order.paid_at = paid_at
        if payment_method is not None:
            order.payment_method = payment_method
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def set_discount(
        db: Session, order: RestroOrder, discount_type: str, discount_value: Decimal
    ) -> RestroOrder:
        order.discount_type = discount_type
        order.discount_value = discount_value
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def set_delivery_status(
        db: Session, order: RestroOrder, delivery_status: str
    ) -> RestroOrder:
        order.delivery_status = delivery_status
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def bump_placed_at(db: Session, order: RestroOrder) -> RestroOrder:
        order.placed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(order)
        return order

    # ------------------------------------------------------------------
    # Order lines
    # ------------------------------------------------------------------

    @staticmethod
    def create_line(
        db: Session,
        order_id: str,
        name: str,
        price: Decimal,
        qty: int,
        note: str | None,
        variant_name: str | None,
        menu_item_id: str | None,
    ) -> RestroOrderLine:
        line = RestroOrderLine(
            order_id=order_id,
            menu_item_id=menu_item_id,
            name=name,
            variant_name=variant_name,
            price=price,
            qty=qty,
            note=note,
            sent=False,
            is_voided=False,
        )
        db.add(line)
        db.commit()
        db.refresh(line)
        return line

    @staticmethod
    def get_line_by_id(db: Session, order_id: str, line_id: str) -> RestroOrderLine | None:
        return (
            db.query(RestroOrderLine)
            .filter(RestroOrderLine.id == line_id, RestroOrderLine.order_id == order_id)
            .first()
        )

    @staticmethod
    def find_unsent_matching_line(
        db: Session,
        order_id: str,
        menu_item_id: str | None,
        variant_name: str | None,
    ) -> RestroOrderLine | None:
        """Look for an existing unsent line with the same menu_item + variant —
        used so tapping the same item twice increments qty instead of creating
        a duplicate row (matches frontend addLine semantics)."""
        q = db.query(RestroOrderLine).filter(
            RestroOrderLine.order_id == order_id,
            RestroOrderLine.sent == False,
            RestroOrderLine.is_voided == False,
        )
        if menu_item_id is not None:
            q = q.filter(RestroOrderLine.menu_item_id == menu_item_id)
        else:
            q = q.filter(RestroOrderLine.menu_item_id.is_(None))
        if variant_name is not None:
            q = q.filter(RestroOrderLine.variant_name == variant_name)
        else:
            q = q.filter(RestroOrderLine.variant_name.is_(None))
        return q.first()

    @staticmethod
    def update_line(
        db: Session,
        line: RestroOrderLine,
        qty: int | None = None,
        note: str | None = None,
    ) -> RestroOrderLine:
        if qty is not None:
            line.qty = qty
        if note is not None:
            line.note = note
        db.commit()
        db.refresh(line)
        return line

    @staticmethod
    def mark_line_voided(
        db: Session, line: RestroOrderLine, reason: str | None
    ) -> RestroOrderLine:
        line.is_voided = True
        line.voided_reason = reason
        db.commit()
        db.refresh(line)
        return line

    @staticmethod
    def delete_line(db: Session, line: RestroOrderLine) -> None:
        db.delete(line)
        db.commit()

    @staticmethod
    def mark_all_unsent_as_sent(db: Session, order_id: str) -> int:
        """Marks every unsent, non-voided line as sent. Returns the count of
        lines that changed."""
        rows = (
            db.query(RestroOrderLine)
            .filter(
                RestroOrderLine.order_id == order_id,
                RestroOrderLine.sent == False,
                RestroOrderLine.is_voided == False,
            )
            .all()
        )
        for line in rows:
            line.sent = True
        db.commit()
        return len(rows)
