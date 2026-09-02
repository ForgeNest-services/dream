from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from shared_models import IMSInvoice, IMSInvoiceLine, IMSParty, IMSInvoiceSerial


class IMSInvoiceRepository:
    @staticmethod
    def next_serial(db: Session, branch_id: str, fiscal_year: str, series: str = "INV") -> int:
        """Atomically increment and return the next serial number for a
        branch/fiscal-year/series combination using SELECT … FOR UPDATE."""
        row = (
            db.execute(
                select(IMSInvoiceSerial)
                .filter_by(branch_id=branch_id, fiscal_year=fiscal_year, series=series)
                .with_for_update()
            )
            .scalars()
            .first()
        )
        if row is None:
            row = IMSInvoiceSerial(
                branch_id=branch_id,
                fiscal_year=fiscal_year,
                series=series,
                last_number=0,
            )
            db.add(row)
            db.flush()

        row.last_number += 1
        db.flush()
        return row.last_number

    @staticmethod
    def create(db: Session, tenant_id: str, **fields) -> IMSInvoice:
        invoice = IMSInvoice(tenant_id=tenant_id, **fields)
        db.add(invoice)
        db.flush()
        return invoice

    @staticmethod
    def add_line(db: Session, invoice_id: str, **fields) -> IMSInvoiceLine:
        line = IMSInvoiceLine(invoice_id=invoice_id, **fields)
        db.add(line)
        return line

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, invoice_id: str) -> IMSInvoice | None:
        return (
            db.query(IMSInvoice)
            .options(joinedload(IMSInvoice.lines))
            .filter(IMSInvoice.id == invoice_id, IMSInvoice.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def register_print(db: Session, invoice: IMSInvoice, printed_by: str | None) -> IMSInvoice:
        """Electronic Billing Procedure 2082, clause 6.2(च): a reprint must
        show "Copy of Original" and the print count — Annexure-3's sample
        formats this as "Copy of Original (1)", "(2)", etc. First print sets
        is_bill_printed (Annexure-5) with no reprint marking; every print
        after that increments reprint_number and flips is_reprint."""
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        if invoice.is_bill_printed:
            invoice.is_reprint = True
            invoice.reprint_number = (invoice.reprint_number or 0) + 1
        else:
            invoice.is_bill_printed = True
        invoice.printed_time = now
        invoice.printed_by = printed_by
        db.commit()
        db.refresh(invoice)
        return invoice

    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        customer_id: str | None,
        fiscal_year_id: str | None,
        status: str | None,
        kind: str | None,
        q: str | None,
        bs_from: str | None,
        bs_to: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[IMSInvoice], int]:
        from sqlalchemy import func, or_

        query = (
            db.query(IMSInvoice)
            .options(joinedload(IMSInvoice.lines))
            .filter(IMSInvoice.tenant_id == tenant_id)
        )
        if branch_id:
            query = query.filter(IMSInvoice.branch_id == branch_id)
        if customer_id:
            query = query.filter(IMSInvoice.customer_id == customer_id)
        if fiscal_year_id:
            query = query.filter(IMSInvoice.fiscal_year_id == fiscal_year_id)
        if status:
            query = query.filter(IMSInvoice.status == status)
        if kind == "quotation":
            query = query.filter(IMSInvoice.kind == "quotation")
        else:
            # Default view (Invoices list) never shows quotations, matching
            # the mock's `.filter(i => i.kind !== "quotation")`.
            query = query.filter(IMSInvoice.kind != "quotation")
        # date_bs is "YYYY-MM-DD" — lexical comparison sorts correctly,
        # same as restro_order.placed_at_bs (see api/utils/bikram_sambat.py).
        if bs_from:
            query = query.filter(IMSInvoice.date_bs >= bs_from)
        if bs_to:
            query = query.filter(IMSInvoice.date_bs <= bs_to)
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.outerjoin(IMSParty, IMSParty.id == IMSInvoice.customer_id).filter(
                or_(
                    func.lower(IMSInvoice.number).like(term),
                    func.lower(IMSParty.name).like(term),
                )
            )
        total = query.distinct().count()
        items = (
            query.distinct()
            .order_by(IMSInvoice.date.desc(), IMSInvoice.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total
