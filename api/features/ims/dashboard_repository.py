from sqlalchemy import func
from sqlalchemy.orm import Session
from features.ims.nepali_date import bs_days_in_month
from shared_models import (
    IMSInvoice,
    IMSInvoiceLine,
    IMSVariant,
    IMSProduct,
    IMSCategory,
    IMSVariantStock,
    IMSStockMovement,
    IMSParty,
    IMSLedgerEntry,
)


class IMSDashboardRepository:
    @staticmethod
    def sales_summary(db: Session, tenant_id: str, branch_id: str | None, bs_from: str | None, bs_to: str | None) -> dict:
        """Total sales + invoice count in the period — a single aggregate,
        not a list, so it's a plain scalar query rather than the
        list_for_tenant pattern used elsewhere."""
        query = db.query(
            func.coalesce(func.sum(IMSInvoice.total_amount), 0).label("total"),
            func.count(IMSInvoice.id).label("count"),
        ).filter(IMSInvoice.tenant_id == tenant_id, IMSInvoice.kind != "quotation")
        if branch_id:
            query = query.filter(IMSInvoice.branch_id == branch_id)
        if bs_from:
            query = query.filter(IMSInvoice.date_bs >= bs_from)
        if bs_to:
            query = query.filter(IMSInvoice.date_bs <= bs_to)
        row = query.first()
        return {"total": row.total, "count": row.count}

    @staticmethod
    def receivables_payables(db: Session, tenant_id: str) -> dict:
        """Outstanding balances — NOT date-filtered (a balance is a running
        total as of now, same reasoning as the party-statement report), only
        the sales-in-period figures respect the date range."""
        rows = (
            db.query(
                IMSParty.kind.label("kind"),
                func.coalesce(func.sum(IMSLedgerEntry.debit), 0).label("debit"),
                func.coalesce(func.sum(IMSLedgerEntry.credit), 0).label("credit"),
            )
            .join(IMSLedgerEntry, IMSLedgerEntry.party_id == IMSParty.id)
            .filter(IMSParty.tenant_id == tenant_id)
            .group_by(IMSParty.kind)
            .all()
        )
        receivable = 0
        payable = 0
        for kind, debit, credit in rows:
            if kind == "customer":
                receivable = max(0, debit - credit)
            elif kind == "supplier":
                payable = max(0, credit - debit)
        return {"receivable": receivable, "payable": payable}

    @staticmethod
    def stock_health(db: Session, tenant_id: str, branch_id: str | None) -> dict:
        """Total stock value (at cost) and low-stock count — live snapshot,
        never date-filtered (stock on hand is a point-in-time fact)."""
        stock_query = db.query(
            IMSVariantStock.variant_id.label("variant_id"),
            func.coalesce(func.sum(IMSVariantStock.qty), 0).label("qty"),
        )
        if branch_id:
            stock_query = stock_query.filter(IMSVariantStock.branch_id == branch_id)
        stock_sub = stock_query.group_by(IMSVariantStock.variant_id).subquery()

        rows = (
            db.query(
                IMSVariant.cost_price,
                IMSVariant.low_stock_at,
                func.coalesce(stock_sub.c.qty, 0).label("qty"),
            )
            .join(IMSProduct, IMSVariant.product_id == IMSProduct.id)
            .outerjoin(stock_sub, stock_sub.c.variant_id == IMSVariant.id)
            .filter(IMSProduct.tenant_id == tenant_id, IMSProduct.is_active == True)
            .all()
        )
        stock_value = sum(r.qty * r.cost_price for r in rows)
        low_stock_count = sum(1 for r in rows if r.qty <= r.low_stock_at)
        return {"stock_value": stock_value, "low_stock_count": low_stock_count}

    @staticmethod
    def sales_trend(db: Session, tenant_id: str, branch_id: str | None, bs_from: str, bs_to: str) -> list[dict]:
        """One row per BS calendar day in [bs_from, bs_to] with that day's
        total sales — days with zero sales are included (as 0), not
        skipped, so the chart doesn't silently compress a quiet day out of
        the x-axis."""
        query = (
            db.query(
                IMSInvoice.date_bs.label("date_bs"),
                func.coalesce(func.sum(IMSInvoice.total_amount), 0).label("total"),
            )
            .filter(
                IMSInvoice.tenant_id == tenant_id,
                IMSInvoice.kind != "quotation",
                IMSInvoice.date_bs >= bs_from,
                IMSInvoice.date_bs <= bs_to,
            )
        )
        if branch_id:
            query = query.filter(IMSInvoice.branch_id == branch_id)
        by_day = {r.date_bs: r.total for r in query.group_by(IMSInvoice.date_bs).all()}

        # Fill every day in the range, not just days with a sale.
        result = []
        y, m, d = (int(x) for x in bs_from.split("-"))
        end = bs_to
        while True:
            key = f"{y:04d}-{m:02d}-{d:02d}"
            result.append({"date_bs": key, "total": by_day.get(key, 0)})
            if key >= end:
                break
            d += 1
            if d > bs_days_in_month(y, m):
                d = 1
                m += 1
                if m > 12:
                    m = 1
                    y += 1
            if len(result) > 400:  # safety valve against a malformed range
                break
        return result

    @staticmethod
    def sales_by_category(db: Session, tenant_id: str, branch_id: str | None, bs_from: str | None, bs_to: str | None) -> list[dict]:
        query = (
            db.query(
                IMSProduct.category_id.label("category_id"),
                func.coalesce(
                    func.sum((IMSInvoiceLine.rate - IMSInvoiceLine.discount) * IMSInvoiceLine.qty), 0
                ).label("total"),
            )
            .join(IMSInvoice, IMSInvoiceLine.invoice_id == IMSInvoice.id)
            .join(IMSVariant, IMSInvoiceLine.variant_id == IMSVariant.id)
            .join(IMSProduct, IMSVariant.product_id == IMSProduct.id)
            .filter(IMSInvoice.tenant_id == tenant_id, IMSInvoice.kind != "quotation")
        )
        if branch_id:
            query = query.filter(IMSInvoice.branch_id == branch_id)
        if bs_from:
            query = query.filter(IMSInvoice.date_bs >= bs_from)
        if bs_to:
            query = query.filter(IMSInvoice.date_bs <= bs_to)
        rows = query.group_by(IMSProduct.category_id).order_by(func.sum((IMSInvoiceLine.rate - IMSInvoiceLine.discount) * IMSInvoiceLine.qty).desc()).all()

        cat_names = {c.id: c.name for c in db.query(IMSCategory).filter(IMSCategory.tenant_id == tenant_id).all()}
        return [
            {"category_id": r.category_id, "category_name": cat_names.get(r.category_id, "—"), "total": r.total}
            for r in rows
        ]

    @staticmethod
    def top_sellers(db: Session, tenant_id: str, branch_id: str | None, bs_from: str | None, bs_to: str | None, limit: int) -> list[dict]:
        query = (
            db.query(
                IMSInvoiceLine.variant_id.label("variant_id"),
                func.sum(IMSInvoiceLine.qty).label("qty_sold"),
                func.sum((IMSInvoiceLine.rate - IMSInvoiceLine.discount) * IMSInvoiceLine.qty).label("revenue"),
            )
            .join(IMSInvoice, IMSInvoiceLine.invoice_id == IMSInvoice.id)
            .filter(IMSInvoice.tenant_id == tenant_id, IMSInvoice.kind != "quotation")
        )
        if branch_id:
            query = query.filter(IMSInvoice.branch_id == branch_id)
        if bs_from:
            query = query.filter(IMSInvoice.date_bs >= bs_from)
        if bs_to:
            query = query.filter(IMSInvoice.date_bs <= bs_to)
        sub = query.group_by(IMSInvoiceLine.variant_id).subquery()

        rows = (
            db.query(IMSVariant, IMSProduct, sub.c.qty_sold, sub.c.revenue)
            .join(sub, sub.c.variant_id == IMSVariant.id)
            .join(IMSProduct, IMSVariant.product_id == IMSProduct.id)
            .order_by(sub.c.revenue.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "variant_id": v.id,
                "product_name": p.name,
                "variant_name": v.name,
                "qty_sold": qty_sold,
                "revenue": revenue,
            }
            for v, p, qty_sold, revenue in rows
        ]

    @staticmethod
    def low_stock_alerts(db: Session, tenant_id: str, branch_id: str | None, limit: int) -> list[dict]:
        stock_query = db.query(
            IMSVariantStock.variant_id.label("variant_id"),
            func.coalesce(func.sum(IMSVariantStock.qty), 0).label("qty"),
        )
        if branch_id:
            stock_query = stock_query.filter(IMSVariantStock.branch_id == branch_id)
        stock_sub = stock_query.group_by(IMSVariantStock.variant_id).subquery()

        rows = (
            db.query(IMSVariant, IMSProduct, func.coalesce(stock_sub.c.qty, 0).label("qty"))
            .join(IMSProduct, IMSVariant.product_id == IMSProduct.id)
            .outerjoin(stock_sub, stock_sub.c.variant_id == IMSVariant.id)
            .filter(
                IMSProduct.tenant_id == tenant_id,
                IMSProduct.is_active == True,
                func.coalesce(stock_sub.c.qty, 0) <= IMSVariant.low_stock_at,
            )
            .order_by(func.coalesce(stock_sub.c.qty, 0))
            .limit(limit)
            .all()
        )
        return [
            {
                "variant_id": v.id,
                "product_name": p.name,
                "variant_name": v.name,
                "stock_qty": qty,
                "low_stock_at": v.low_stock_at,
            }
            for v, p, qty in rows
        ]

    @staticmethod
    def recent_movements(db: Session, tenant_id: str, branch_id: str | None, limit: int) -> list[dict]:
        query = (
            db.query(IMSStockMovement, IMSProduct, IMSVariant)
            .join(IMSVariant, IMSStockMovement.variant_id == IMSVariant.id)
            .join(IMSProduct, IMSStockMovement.product_id == IMSProduct.id)
            .filter(IMSStockMovement.tenant_id == tenant_id)
        )
        if branch_id:
            query = query.filter(IMSStockMovement.branch_id == branch_id)
        rows = query.order_by(IMSStockMovement.date.desc()).limit(limit).all()
        return [
            {
                "id": m.id,
                "date": m.date,
                "product_name": p.name,
                "variant_name": v.name,
                "type": m.type,
                "qty": m.qty,
                "balance_after": m.balance_after,
            }
            for m, p, v in rows
        ]
