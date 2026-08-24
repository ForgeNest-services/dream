from datetime import timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session
from utils.bikram_sambat import bs_iso_to_ad
from shared_models import (
    IMSVariant,
    IMSVariantStock,
    IMSProduct,
    IMSInvoiceLine,
    IMSInvoice,
    IMSLedgerEntry,
    IMSParty,
)


class IMSReportsRepository:
    @staticmethod
    def stock_summary(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        category_id: str | None,
        q: str | None,
        low_stock_only: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        """One row per variant: on-hand qty (branch-filtered or summed
        across all branches), cost/retail value. low_stock_only filters to
        qty <= low_stock_at, matching Variant.lowStockAt's existing
        semantics used client-side today (see app-store's stockOf)."""
        stock_query = db.query(
            IMSVariantStock.variant_id.label("variant_id"),
            func.coalesce(func.sum(IMSVariantStock.qty), 0).label("qty"),
        )
        if branch_id:
            stock_query = stock_query.filter(IMSVariantStock.branch_id == branch_id)
        stock_sub = stock_query.group_by(IMSVariantStock.variant_id).subquery()

        query = (
            db.query(
                IMSVariant,
                IMSProduct,
                func.coalesce(stock_sub.c.qty, 0).label("stock_qty"),
            )
            .join(IMSProduct, IMSVariant.product_id == IMSProduct.id)
            .outerjoin(stock_sub, stock_sub.c.variant_id == IMSVariant.id)
            .filter(IMSProduct.tenant_id == tenant_id, IMSProduct.is_active == True)
        )
        if category_id:
            query = query.filter(IMSProduct.category_id == category_id)
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.filter(
                func.lower(IMSProduct.name).like(term) | func.lower(IMSVariant.name).like(term)
            )
        if low_stock_only:
            query = query.filter(func.coalesce(stock_sub.c.qty, 0) <= IMSVariant.low_stock_at)

        total = query.count()
        rows = (
            query.order_by(IMSProduct.name, IMSVariant.name)
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [
            {
                "variant": v,
                "product": p,
                "stock_qty": qty,
            }
            for v, p, qty in rows
        ], total

    @staticmethod
    def margin(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        category_id: str | None,
        bs_from: str | None,
        bs_to: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        """Revenue/cost/profit per variant, aggregated across every
        matching invoice line (never a lump lookup — see IMSVariant.cost_price
        being the CURRENT cost, not a historical snapshot, so this reports
        today's margin using today's cost basis against historical revenue;
        a true historical-cost margin would need per-line cost snapshots,
        which invoice lines don't carry — documented limitation)."""
        query = (
            db.query(
                IMSInvoiceLine.variant_id.label("variant_id"),
                func.sum(IMSInvoiceLine.qty).label("qty_sold"),
                func.sum((IMSInvoiceLine.rate - IMSInvoiceLine.discount) * IMSInvoiceLine.qty).label(
                    "revenue"
                ),
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
        if category_id:
            query = query.join(IMSVariant, IMSInvoiceLine.variant_id == IMSVariant.id).join(
                IMSProduct, IMSVariant.product_id == IMSProduct.id
            ).filter(IMSProduct.category_id == category_id)

        sub = query.group_by(IMSInvoiceLine.variant_id).subquery()

        full = (
            db.query(
                IMSVariant,
                IMSProduct,
                sub.c.qty_sold,
                sub.c.revenue,
            )
            .join(sub, sub.c.variant_id == IMSVariant.id)
            .join(IMSProduct, IMSVariant.product_id == IMSProduct.id)
        )
        total = full.count()
        rows = (
            full.order_by(sub.c.revenue.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [
            {
                "variant": v,
                "product": p,
                "qty_sold": qty_sold,
                "revenue": revenue,
                "cost": v.cost_price * qty_sold,
            }
            for v, p, qty_sold, revenue in rows
        ], total

    @staticmethod
    def party_statement(
        db: Session,
        tenant_id: str,
        kind: str,
        q: str | None,
        bs_from: str | None,
        bs_to: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        """One row per party: total debit/credit within the date range (if
        given) and running balance — balance sign matches app-store's
        partyBalance (customer: debit - credit; supplier: credit - debit),
        computed over ALL entries regardless of date filter, since a
        balance is a running total, not a period figure — the date filter
        only narrows which period's debit/credit activity is shown."""
        # IMSLedgerEntry.date is a real AD DateTime with no date_bs mirror
        # (unlike Invoice/Purchase) — convert the BS range to AD before
        # filtering, rather than comparing a datetime column against a BS
        # string, which would silently misbehave.
        ledger_sub = db.query(IMSLedgerEntry).filter(IMSLedgerEntry.tenant_id == tenant_id)
        if bs_from:
            ad_from = bs_iso_to_ad(bs_from)
            if ad_from:
                ledger_sub = ledger_sub.filter(IMSLedgerEntry.date >= ad_from)
        if bs_to:
            ad_to = bs_iso_to_ad(bs_to)
            if ad_to:
                # Exclusive upper bound on the day AFTER bs_to, so entries
                # recorded any time during bs_to itself are still included.
                ledger_sub = ledger_sub.filter(IMSLedgerEntry.date < ad_to + timedelta(days=1))
        period_sub = (
            ledger_sub.with_entities(
                IMSLedgerEntry.party_id.label("party_id"),
                func.sum(IMSLedgerEntry.debit).label("period_debit"),
                func.sum(IMSLedgerEntry.credit).label("period_credit"),
            )
            .group_by(IMSLedgerEntry.party_id)
            .subquery()
        )
        balance_sub = (
            db.query(
                IMSLedgerEntry.party_id.label("party_id"),
                func.sum(IMSLedgerEntry.debit).label("total_debit"),
                func.sum(IMSLedgerEntry.credit).label("total_credit"),
            )
            .filter(IMSLedgerEntry.tenant_id == tenant_id)
            .group_by(IMSLedgerEntry.party_id)
            .subquery()
        )

        query = (
            db.query(
                IMSParty,
                func.coalesce(period_sub.c.period_debit, 0).label("period_debit"),
                func.coalesce(period_sub.c.period_credit, 0).label("period_credit"),
                func.coalesce(balance_sub.c.total_debit, 0).label("total_debit"),
                func.coalesce(balance_sub.c.total_credit, 0).label("total_credit"),
            )
            .outerjoin(period_sub, period_sub.c.party_id == IMSParty.id)
            .outerjoin(balance_sub, balance_sub.c.party_id == IMSParty.id)
            .filter(IMSParty.tenant_id == tenant_id, IMSParty.kind == kind)
        )
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.filter(func.lower(IMSParty.name).like(term))

        total = query.count()
        rows = query.order_by(IMSParty.name).offset(offset).limit(limit).all()

        result = []
        for party, p_debit, p_credit, t_debit, t_credit in rows:
            balance = (t_credit - t_debit) if kind == "supplier" else (t_debit - t_credit)
            result.append(
                {
                    "party": party,
                    "period_debit": p_debit,
                    "period_credit": p_credit,
                    "balance": balance,
                }
            )
        return result, total
