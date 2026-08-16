"""Read-only aggregations for the RMS dashboard and reports screens.

All queries scope by tenant_id + branch_id; BS date range filters hit the
(branch_id, placed_at_bs) composite index. Numeric totals that involve the
discount+VAT formula are computed in Python by callers via
`compute_order_total`, since the formula (percent-or-flat discount, then
VAT on the taxable base) doesn't translate cleanly to SQL.
"""

from decimal import Decimal
from sqlalchemy import func, and_, or_, case
from sqlalchemy.orm import Session, joinedload

from shared_models import (
    RestroOrder,
    RestroOrderLine,
    RestroMenuItem,
    RestroCategory,
    RestroExpense,
    RestroInventoryItem,
    RestroTable,
)


class ReportsRepository:
    # ------------------------------------------------------------------
    # Orders — fetched with lines eagerly loaded so callers can call
    # compute_order_total() without triggering per-row selects.
    # ------------------------------------------------------------------

    @staticmethod
    def paid_orders_in_range(
        db: Session,
        tenant_id: str,
        branch_id: str,
        bs_from: str | None,
        bs_to: str | None,
    ) -> list[RestroOrder]:
        q = db.query(RestroOrder).options(joinedload(RestroOrder.lines)).filter(
            RestroOrder.tenant_id == tenant_id,
            RestroOrder.branch_id == branch_id,
            RestroOrder.status == "paid",
        )
        if bs_from:
            q = q.filter(RestroOrder.placed_at_bs >= bs_from)
        if bs_to:
            q = q.filter(RestroOrder.placed_at_bs <= bs_to)
        return q.all()

    @staticmethod
    def order_counts_in_range(
        db: Session,
        tenant_id: str,
        branch_id: str,
        bs_from: str | None,
        bs_to: str | None,
    ) -> dict:
        """Cheap COUNT(*) breakdown by status — separate from paid_orders_in_range
        so callers who only want counts don't have to load lines."""
        q = db.query(
            RestroOrder.status, func.count(RestroOrder.id)
        ).filter(
            RestroOrder.tenant_id == tenant_id,
            RestroOrder.branch_id == branch_id,
        )
        if bs_from:
            q = q.filter(RestroOrder.placed_at_bs >= bs_from)
        if bs_to:
            q = q.filter(RestroOrder.placed_at_bs <= bs_to)
        rows = q.group_by(RestroOrder.status).all()
        buckets = {"draft": 0, "paid": 0, "cancelled": 0}
        for status, n in rows:
            buckets[status] = int(n)
        return buckets

    # ------------------------------------------------------------------
    # Line-item aggregations — pushed to SQL because they only touch snapshot
    # columns (qty, price) and don't need the discount/VAT formula.
    # ------------------------------------------------------------------

    @staticmethod
    def items_sold_count(
        db: Session,
        tenant_id: str,
        branch_id: str,
        bs_from: str | None,
        bs_to: str | None,
    ) -> int:
        q = (
            db.query(func.coalesce(func.sum(RestroOrderLine.qty), 0))
            .join(RestroOrder, RestroOrder.id == RestroOrderLine.order_id)
            .filter(
                RestroOrder.tenant_id == tenant_id,
                RestroOrder.branch_id == branch_id,
                RestroOrder.status == "paid",
                RestroOrderLine.is_voided.is_(False),
            )
        )
        if bs_from:
            q = q.filter(RestroOrder.placed_at_bs >= bs_from)
        if bs_to:
            q = q.filter(RestroOrder.placed_at_bs <= bs_to)
        return int(q.scalar() or 0)

    @staticmethod
    def by_category(
        db: Session,
        tenant_id: str,
        branch_id: str,
        bs_from: str | None,
        bs_to: str | None,
    ) -> list[dict]:
        """[{category_name, qty, revenue}] — revenue is naive line total
        (qty × unit_price snapshot) without discount/VAT, since those apply
        at the order level, not per-line. Lines whose menu_item was deleted
        bucket as "Uncategorized"."""
        cat_name = func.coalesce(RestroCategory.name, "Uncategorized").label("cat_name")
        q = (
            db.query(
                cat_name,
                func.coalesce(func.sum(RestroOrderLine.qty), 0).label("qty"),
                func.coalesce(
                    func.sum(RestroOrderLine.qty * RestroOrderLine.price), 0
                ).label("revenue"),
            )
            .join(RestroOrder, RestroOrder.id == RestroOrderLine.order_id)
            .outerjoin(RestroMenuItem, RestroMenuItem.id == RestroOrderLine.menu_item_id)
            .outerjoin(RestroCategory, RestroCategory.id == RestroMenuItem.category_id)
            .filter(
                RestroOrder.tenant_id == tenant_id,
                RestroOrder.branch_id == branch_id,
                RestroOrder.status == "paid",
                RestroOrderLine.is_voided.is_(False),
            )
        )
        if bs_from:
            q = q.filter(RestroOrder.placed_at_bs >= bs_from)
        if bs_to:
            q = q.filter(RestroOrder.placed_at_bs <= bs_to)
        rows = q.group_by(cat_name).order_by(func.sum(RestroOrderLine.qty * RestroOrderLine.price).desc()).all()
        return [
            {"category": r.cat_name, "qty": int(r.qty), "revenue": Decimal(r.revenue or 0)}
            for r in rows
        ]

    @staticmethod
    def top_items(
        db: Session,
        tenant_id: str,
        branch_id: str,
        bs_from: str | None,
        bs_to: str | None,
        limit: int,
    ) -> list[dict]:
        """Group by (name, variant_name) so "Steam Momo · Chicken" and
        "Steam Momo · Veg" appear as distinct rows — that's what people
        actually want to see in a top-sellers list."""
        variant_label = func.coalesce(RestroOrderLine.variant_name, "").label("variant")
        q = (
            db.query(
                RestroOrderLine.name.label("name"),
                variant_label,
                func.coalesce(func.sum(RestroOrderLine.qty), 0).label("qty"),
                func.coalesce(
                    func.sum(RestroOrderLine.qty * RestroOrderLine.price), 0
                ).label("revenue"),
            )
            .join(RestroOrder, RestroOrder.id == RestroOrderLine.order_id)
            .filter(
                RestroOrder.tenant_id == tenant_id,
                RestroOrder.branch_id == branch_id,
                RestroOrder.status == "paid",
                RestroOrderLine.is_voided.is_(False),
            )
        )
        if bs_from:
            q = q.filter(RestroOrder.placed_at_bs >= bs_from)
        if bs_to:
            q = q.filter(RestroOrder.placed_at_bs <= bs_to)
        rows = (
            q.group_by(RestroOrderLine.name, variant_label)
            .order_by(func.sum(RestroOrderLine.qty).desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "name": r.name,
                "variant_name": r.variant or None,
                "qty": int(r.qty),
                "revenue": Decimal(r.revenue or 0),
            }
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Expenses — separate table, joined by BS date not orders.
    # ------------------------------------------------------------------

    @staticmethod
    def expenses_total_and_by_category(
        db: Session,
        tenant_id: str,
        branch_id: str,
        bs_from: str | None,
        bs_to: str | None,
    ) -> dict:
        q = db.query(
            RestroExpense.category,
            func.coalesce(func.sum(RestroExpense.amount), 0).label("amount"),
        ).filter(
            RestroExpense.tenant_id == tenant_id,
            RestroExpense.branch_id == branch_id,
        )
        if bs_from:
            q = q.filter(RestroExpense.spent_at_bs >= bs_from)
        if bs_to:
            q = q.filter(RestroExpense.spent_at_bs <= bs_to)
        rows = q.group_by(RestroExpense.category).order_by(
            func.sum(RestroExpense.amount).desc()
        ).all()
        total = sum((Decimal(r.amount or 0) for r in rows), Decimal("0"))
        by_category = [
            {"category": r.category, "amount": Decimal(r.amount or 0)} for r in rows
        ]
        return {"total": total, "by_category": by_category}

    # ------------------------------------------------------------------
    # Table + inventory snapshots for the dashboard live tiles.
    # ------------------------------------------------------------------

    @staticmethod
    def table_occupancy(db: Session, tenant_id: str, branch_id: str) -> dict:
        rows = (
            db.query(RestroTable.status, func.count(RestroTable.id))
            .filter(
                RestroTable.tenant_id == tenant_id,
                RestroTable.branch_id == branch_id,
                RestroTable.is_active.is_(True),
            )
            .group_by(RestroTable.status)
            .all()
        )
        buckets = {"empty": 0, "occupied": 0, "reserved": 0}
        for status, n in rows:
            buckets[status] = int(n)
        total = sum(buckets.values())
        return {"occupied": buckets["occupied"], "total": total}

    @staticmethod
    def low_stock_count(db: Session, tenant_id: str, branch_id: str) -> int:
        return (
            db.query(func.count(RestroInventoryItem.id))
            .filter(
                RestroInventoryItem.tenant_id == tenant_id,
                RestroInventoryItem.branch_id == branch_id,
                RestroInventoryItem.stock <= RestroInventoryItem.threshold,
            )
            .scalar()
            or 0
        )
