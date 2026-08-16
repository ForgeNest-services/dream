"""Reports/dashboard orchestration. Combines per-order totals (computed in
Python via compute_order_total so discount+VAT match the receipt) with SQL
breakdowns (categories, expenses, top items). All money returned as Decimal
and serialized as strings by the router — never float."""

from datetime import timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from features.restro.reports_repository import ReportsRepository
from features.restro.order_service import compute_order_total
from features.branches.repository import BranchRepository
from utils.bikram_sambat import to_bs_iso, bs_iso_to_ad


def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
    return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None


def _sum_totals(orders) -> Decimal:
    return sum((compute_order_total(o) for o in orders), Decimal("0"))


def _by_payment_method(orders) -> dict:
    """Group paid orders by payment method (cash/qr/khata) with summed totals.
    Matches the "how did the money come in" cut on the sales report."""
    buckets: dict[str, Decimal] = {"cash": Decimal("0"), "qr": Decimal("0"), "khata": Decimal("0")}
    counts: dict[str, int] = {"cash": 0, "qr": 0, "khata": 0}
    for o in orders:
        method = o.payment_method or "cash"
        if method not in buckets:
            buckets[method] = Decimal("0")
            counts[method] = 0
        buckets[method] += compute_order_total(o)
        counts[method] += 1
    return {
        "cash": {"amount": buckets["cash"], "count": counts["cash"]},
        "qr": {"amount": buckets["qr"], "count": counts["qr"]},
        "khata": {"amount": buckets["khata"], "count": counts["khata"]},
    }


def _range_summary(
    db: Session,
    tenant_id: str,
    branch_id: str,
    bs_from: str | None,
    bs_to: str | None,
) -> dict:
    """Shared engine for both daily and range summaries — daily is just a
    single-day range. Keeps the two endpoints structurally identical so the
    frontend can render them with one component."""
    paid = ReportsRepository.paid_orders_in_range(db, tenant_id, branch_id, bs_from, bs_to)
    counts = ReportsRepository.order_counts_in_range(db, tenant_id, branch_id, bs_from, bs_to)
    items_sold = ReportsRepository.items_sold_count(db, tenant_id, branch_id, bs_from, bs_to)
    by_cat = ReportsRepository.by_category(db, tenant_id, branch_id, bs_from, bs_to)
    exp = ReportsRepository.expenses_total_and_by_category(db, tenant_id, branch_id, bs_from, bs_to)

    sales_gross = _sum_totals(paid)
    net = sales_gross - exp["total"]
    return {
        "bs_from": bs_from,
        "bs_to": bs_to,
        "orders": {
            "placed": counts["draft"] + counts["paid"] + counts["cancelled"],
            "paid": counts["paid"],
            "draft": counts["draft"],
            "cancelled": counts["cancelled"],
        },
        "items_sold": items_sold,
        "sales_gross": sales_gross,
        "expenses_total": exp["total"],
        "net": net,
        "by_category": by_cat,
        "by_payment": _by_payment_method(paid),
        "expenses_by_category": exp["by_category"],
    }


def _iter_bs_days(bs_from: str, bs_to: str):
    """Walk BS days from bs_from to bs_to inclusive by converting the BS range
    to Gregorian, iterating day-by-day, and converting back. BS calendar has
    variable-length months so we can't just increment day-of-month directly."""
    ad_from = bs_iso_to_ad(bs_from)
    ad_to = bs_iso_to_ad(bs_to)
    if not ad_from or not ad_to:
        return
    if ad_to < ad_from:
        return
    d = ad_from
    while d <= ad_to:
        bs = to_bs_iso(d)
        if bs:
            yield bs
        d = d + timedelta(days=1)


class ReportsService:
    @staticmethod
    def daily_summary(db: Session, tenant_id: str, branch_id: str, bs: str) -> dict:
        if not _assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        summary = _range_summary(db, tenant_id, branch_id, bs, bs)
        return {"success": True, "summary": summary}

    @staticmethod
    def range_summary(
        db: Session, tenant_id: str, branch_id: str, bs_from: str, bs_to: str
    ) -> dict:
        if not _assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if bs_to < bs_from:
            return {"success": False, "error_code": "INVALID_RANGE"}
        summary = _range_summary(db, tenant_id, branch_id, bs_from, bs_to)
        return {"success": True, "summary": summary}

    @staticmethod
    def top_items(
        db: Session, tenant_id: str, branch_id: str, bs_from: str | None,
        bs_to: str | None, limit: int,
    ) -> dict:
        if not _assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        items = ReportsRepository.top_items(
            db, tenant_id, branch_id, bs_from, bs_to, max(1, min(limit, 50))
        )
        return {"success": True, "items": items}

    @staticmethod
    def sales_trend(
        db: Session, tenant_id: str, branch_id: str, bs_from: str, bs_to: str
    ) -> dict:
        """Per-day sales/orders/expenses rows for line-chart rendering. Fills
        in zero rows for days with no activity so the chart's X-axis is
        continuous — a gap in the data would look like missing days."""
        if not _assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if bs_to < bs_from:
            return {"success": False, "error_code": "INVALID_RANGE"}

        paid = ReportsRepository.paid_orders_in_range(db, tenant_id, branch_id, bs_from, bs_to)
        exp = ReportsRepository.expenses_total_and_by_category(
            db, tenant_id, branch_id, bs_from, bs_to
        )

        # Bucket orders by placed_at_bs day.
        sales_by_day: dict[str, Decimal] = {}
        count_by_day: dict[str, int] = {}
        for o in paid:
            day = o.placed_at_bs
            sales_by_day[day] = sales_by_day.get(day, Decimal("0")) + compute_order_total(o)
            count_by_day[day] = count_by_day.get(day, 0) + 1

        # Expenses need their own bucket keyed by spent_at_bs.
        # ReportsRepository returns totals lumped by category, not by day —
        # we need per-day so query raw here.
        from shared_models import RestroExpense
        from sqlalchemy import func
        exp_rows = (
            db.query(
                RestroExpense.spent_at_bs,
                func.coalesce(func.sum(RestroExpense.amount), 0),
            )
            .filter(
                RestroExpense.tenant_id == tenant_id,
                RestroExpense.branch_id == branch_id,
                RestroExpense.spent_at_bs >= bs_from,
                RestroExpense.spent_at_bs <= bs_to,
            )
            .group_by(RestroExpense.spent_at_bs)
            .all()
        )
        expenses_by_day: dict[str, Decimal] = {
            day: Decimal(amount or 0) for day, amount in exp_rows
        }

        # Emit one row per day so the chart X-axis is continuous.
        trend = []
        for bs_day in _iter_bs_days(bs_from, bs_to):
            trend.append(
                {
                    "bs_date": bs_day,
                    "sales": sales_by_day.get(bs_day, Decimal("0")),
                    "orders": count_by_day.get(bs_day, 0),
                    "expenses": expenses_by_day.get(bs_day, Decimal("0")),
                }
            )
        return {"success": True, "trend": trend}

    @staticmethod
    def dashboard(
        db: Session, tenant_id: str, branch_id: str, bs: str | None = None
    ) -> dict:
        """One-shot bundle for the dashboard landing screen. `bs` is optional
        — omit for "today" (server clock, NPT), or pass a BS date to view a
        past day (managers reconciling yesterday's cash, etc.). The 7-day
        trend and top-items window is anchored on `bs`, so viewing 2083-05-27
        shows that day + the 6 days leading up to it."""
        if not _assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        from datetime import date
        if bs:
            anchor_ad = bs_iso_to_ad(bs)
            if anchor_ad is None:
                return {"success": False, "error_code": "INVALID_DATE"}
        else:
            anchor_ad = date.today()

        anchor_bs = to_bs_iso(anchor_ad)
        yesterday_bs = to_bs_iso(anchor_ad - timedelta(days=1))
        seven_days_ago_bs = to_bs_iso(anchor_ad - timedelta(days=6))  # inclusive → 7 days
        if not anchor_bs or not yesterday_bs or not seven_days_ago_bs:
            return {"success": False, "error_code": "BS_CONVERSION_FAILED"}

        today_summary = _range_summary(db, tenant_id, branch_id, anchor_bs, anchor_bs)
        yesterday_summary = _range_summary(db, tenant_id, branch_id, yesterday_bs, yesterday_bs)

        trend_result = ReportsService.sales_trend(
            db, tenant_id, branch_id, seven_days_ago_bs, anchor_bs
        )
        top = ReportsRepository.top_items(
            db, tenant_id, branch_id, seven_days_ago_bs, anchor_bs, 5
        )
        occ = ReportsRepository.table_occupancy(db, tenant_id, branch_id)
        low_stock = ReportsRepository.low_stock_count(db, tenant_id, branch_id)

        return {
            "success": True,
            "dashboard": {
                "anchor_bs": anchor_bs,
                "today": today_summary,
                "yesterday_sales": yesterday_summary["sales_gross"],
                "trend_7_days": trend_result.get("trend", []),
                "top_items": top,
                "tables": occ,
                "low_stock_count": int(low_stock),
            },
        }
