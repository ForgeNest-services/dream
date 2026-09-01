from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import and_, or_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from shared_models import RestroOrder, RestroOrderLine, RestroTable, RestroCustomer, RestroInvoiceSerial
from utils.bikram_sambat import to_bs_iso, fiscal_year_from_ad


ORDER_TYPES = {"dine-in", "delivery"}
ORDER_STATUSES = {"draft", "paid", "cancelled"}
KITCHEN_STATUSES = {"new", "cooking", "ready", "served"}
DELIVERY_STATUSES = {"pending", "out", "delivered"}
# `card` was dropped when we replaced it with `khata` (running tab) — Nepal
# doesn't have widespread card infra anyway and khata is what shopkeepers
# actually use.
PAYMENT_METHODS = {"cash", "qr", "khata"}
# Only these two are valid when *settling* a khata balance (customer paying
# down their tab). Khata itself isn't a valid settlement — that'd be circular.
KHATA_SETTLEMENT_METHODS = {"cash", "qr"}
DISCOUNT_TYPES = {"percent", "flat"}


class OrderRepository:
    # ------------------------------------------------------------------
    # Orders
    # ------------------------------------------------------------------

    @staticmethod
    def _next_bill_number(db: Session, branch_id: str, fiscal_year: str) -> int:
        """Atomically increment the per-branch/fiscal-year bill counter using
        SELECT … FOR UPDATE so concurrent orders never share a number (IRD
        gapless serial requirement)."""
        row = (
            db.execute(
                select(RestroInvoiceSerial)
                .filter_by(branch_id=branch_id, fiscal_year=fiscal_year)
                .with_for_update()
            )
            .scalars()
            .first()
        )
        if row is None:
            row = RestroInvoiceSerial(
                branch_id=branch_id,
                fiscal_year=fiscal_year,
                last_number=0,
            )
            db.add(row)
            db.flush()
        row.last_number += 1
        db.flush()
        return row.last_number

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
    ) -> RestroOrder:
        # Snapshot placed_at + its BS equivalent together. Using an explicit
        # timestamp (instead of relying on the model default) so both columns
        # agree on the exact same moment — the default runs at flush, which
        # would compute BS from a slightly earlier `now()`.
        now = datetime.now(timezone.utc)
        fy = fiscal_year_from_ad(now) or ""
        bill_num = OrderRepository._next_bill_number(db, branch_id, fy)

        order = RestroOrder(
            tenant_id=tenant_id,
            branch_id=branch_id,
            type=type,
            status="draft",
            kitchen_status="new",
            table_id=table_id,
            customer_id=customer_id,
            bill_number=bill_num,
            fiscal_year=fy,
            placed_at=now,
            placed_at_bs=to_bs_iso(now) or "",
            waiter_name=waiter_name,
            waiter_cred_id=waiter_cred_id,
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
    def increment_print_count(db: Session, order: RestroOrder) -> RestroOrder:
        """IRD: printing a paid bill more than once must be visibly watermarked
        as a copy. Called once per actual print action — the caller (service
        layer) decides what "print" means (e.g. clicking Print Bill), this
        just atomically bumps the counter and returns the new count."""
        order.print_count = (order.print_count or 0) + 1
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def _apply_order_filters(
        query,
        *,
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
    ):
        """Shared filter clause used by both list_for_branch and
        list_paginated so the two never drift."""
        query = query.filter(
            RestroOrder.tenant_id == tenant_id,
            RestroOrder.branch_id == branch_id,
        )
        if status:
            query = query.filter(RestroOrder.status == status)
        if type:
            query = query.filter(RestroOrder.type == type)
        if kitchen_status:
            query = query.filter(RestroOrder.kitchen_status == kitchen_status)
        if table_id:
            query = query.filter(RestroOrder.table_id == table_id)
        if payment_method:
            query = query.filter(RestroOrder.payment_method == payment_method)
        # BS date range hits the (branch_id, placed_at_bs) composite index.
        # placed_at_bs is stored as "YYYY-MM-DD" so lexical comparison is
        # equivalent to date comparison.
        if bs_from:
            query = query.filter(RestroOrder.placed_at_bs >= bs_from)
        if bs_to:
            query = query.filter(RestroOrder.placed_at_bs <= bs_to)
        # Search across waiter, customer name/phone, table label, and — for
        # digit-only queries — the exact bill number. UUID matching was
        # removed because UUIDs contain every digit and character; searching
        # "1" matched most rows. Digit-only-as-bill-number is what a waiter
        # actually types when they want "bill 42".
        if search:
            term_raw = search.strip()
            term = f"%{term_raw.lower()}%"
            conditions = [
                func.lower(RestroOrder.waiter_name).like(term),
                func.lower(RestroCustomer.name).like(term),
                func.lower(RestroCustomer.phone).like(term),
                func.lower(RestroTable.label).like(term),
            ]
            if term_raw.isdigit():
                try:
                    conditions.append(RestroOrder.bill_number == int(term_raw))
                except ValueError:
                    pass
            query = (
                query.outerjoin(RestroTable, RestroOrder.table_id == RestroTable.id)
                .outerjoin(RestroCustomer, RestroOrder.customer_id == RestroCustomer.id)
                .filter(or_(*conditions))
            )
        return query

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
        q = OrderRepository._apply_order_filters(
            db.query(RestroOrder),
            tenant_id=tenant_id,
            branch_id=branch_id,
            status=status,
            type=type,
            kitchen_status=kitchen_status,
            table_id=table_id,
        )
        q = q.order_by(RestroOrder.placed_at.desc())
        if limit:
            q = q.limit(limit)
        return q.all()

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
    ) -> tuple[list[RestroOrder], int]:
        base = OrderRepository._apply_order_filters(
            db.query(RestroOrder),
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
        )
        # Count using a subquery-friendly aggregate — .with_entities lets us
        # reuse `base` (which may include an outer join for search) without
        # re-running the join logic separately.
        total = base.with_entities(func.count(RestroOrder.id.distinct())).scalar() or 0
        items = (
            base.order_by(RestroOrder.placed_at.desc()).offset(offset).limit(limit).all()
        )
        return items, total

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
        customer_id: str | None = None,
        settled_at: datetime | None = None,
        clear_settled_at: bool = False,
    ) -> RestroOrder:
        if status is not None:
            order.status = status
        if kitchen_status is not None:
            order.kitchen_status = kitchen_status
        if paid_at is not None:
            order.paid_at = paid_at
            # Keep the BS mirror in lockstep.
            order.paid_at_bs = to_bs_iso(paid_at)
        if payment_method is not None:
            order.payment_method = payment_method
        if customer_id is not None:
            order.customer_id = customer_id
        # clear_settled_at wins over settled_at so a khata mark-paid can
        # explicitly null it in the same call that also sets paid_at.
        if clear_settled_at:
            order.settled_at = None
            order.settled_at_bs = None
        elif settled_at is not None:
            order.settled_at = settled_at
            order.settled_at_bs = to_bs_iso(settled_at)
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def list_khata_orders_for_customer(
        db: Session, tenant_id: str, customer_id: str
    ) -> list[RestroOrder]:
        """Every khata order for this customer (closed bills that hit their
        tab). Used by balance-computation as the debit side of the ledger;
        settlements are the credit side. Draft khata orders don't exist —
        khata is only set at mark-paid time."""
        return (
            db.query(RestroOrder)
            .filter(
                RestroOrder.tenant_id == tenant_id,
                RestroOrder.customer_id == customer_id,
                RestroOrder.payment_method == "khata",
                RestroOrder.status == "paid",
            )
            .order_by(RestroOrder.placed_at.asc())
            .all()
        )

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
        now = datetime.now(timezone.utc)
        order.placed_at = now
        # Refresh the BS mirror so it always matches placed_at.
        order.placed_at_bs = to_bs_iso(now) or order.placed_at_bs
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
