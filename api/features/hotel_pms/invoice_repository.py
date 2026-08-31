from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from shared_models import PMSInvoice, PMSInvoiceSerial
from utils.bikram_sambat import fiscal_year_from_ad, format_invoice_number


class InvoiceRepository:

    # ── Serial counter ───────────────────────────────────────────────────────

    @staticmethod
    def next_serial(db: Session, branch_id: str, fiscal_year: str, series: str = "INV") -> int:
        """Atomically increment and return the next serial number.

        Uses SELECT … WITH FOR UPDATE to prevent gaps under concurrent requests.
        """
        row = (
            db.execute(
                select(PMSInvoiceSerial)
                .filter_by(branch_id=branch_id, fiscal_year=fiscal_year, series=series)
                .with_for_update()
            )
            .scalars()
            .first()
        )
        if row is None:
            row = PMSInvoiceSerial(
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

    # ── Invoice CRUD ─────────────────────────────────────────────────────────

    @staticmethod
    def create(
        db: Session,
        *,
        tenant_id: str,
        branch_id: str,
        booking_id: str | None,
        series: str,
        # seller
        seller_name: str,
        seller_address: str | None,
        seller_pan: str | None,
        seller_is_vat_registered: bool,
        # buyer
        buyer_name: str,
        buyer_pan: str | None,
        buyer_address: str | None,
        # amounts
        subtotal_amount: Decimal,
        taxable_amount: Decimal,
        vat_amount: Decimal,
        total_amount: Decimal,
        # line items
        line_items: list[dict],
        # reprint / note fields
        is_reprint: bool = False,
        reprint_of: str | None = None,
        reprint_number: int | None = None,
        original_invoice_id: str | None = None,
        note_reason: str | None = None,
    ) -> PMSInvoice:
        today = datetime.now(timezone.utc).date()
        fiscal_year = fiscal_year_from_ad(today)
        serial = InvoiceRepository.next_serial(db, branch_id, fiscal_year, series)
        invoice_number = format_invoice_number(series, fiscal_year, serial)

        inv = PMSInvoice(
            tenant_id=tenant_id,
            branch_id=branch_id,
            booking_id=booking_id,
            series=series,
            invoice_number=invoice_number,
            fiscal_year=fiscal_year,
            serial_number=serial,
            seller_name=seller_name,
            seller_address=seller_address,
            seller_pan=seller_pan,
            seller_is_vat_registered=seller_is_vat_registered,
            buyer_name=buyer_name,
            buyer_pan=buyer_pan,
            buyer_address=buyer_address,
            subtotal_amount=subtotal_amount,
            taxable_amount=taxable_amount,
            vat_amount=vat_amount,
            total_amount=total_amount,
            line_items=line_items,
            is_reprint=is_reprint,
            reprint_of=reprint_of,
            reprint_number=reprint_number,
            original_invoice_id=original_invoice_id,
            note_reason=note_reason,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        return inv

    @staticmethod
    def get_by_id(db: Session, invoice_id: str, tenant_id: str) -> PMSInvoice | None:
        return (
            db.query(PMSInvoice)
            .filter(PMSInvoice.id == invoice_id, PMSInvoice.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def get_by_booking(db: Session, booking_id: str, tenant_id: str, series: str = "INV") -> PMSInvoice | None:
        return (
            db.query(PMSInvoice)
            .filter(
                PMSInvoice.booking_id == booking_id,
                PMSInvoice.tenant_id == tenant_id,
                PMSInvoice.series == series,
                PMSInvoice.is_reprint == False,  # noqa: E712
                PMSInvoice.original_invoice_id.is_(None),
            )
            .first()
        )

    @staticmethod
    def list_for_branch(
        db: Session,
        branch_id: str,
        tenant_id: str,
        series: str | None = None,
        fiscal_year: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[PMSInvoice], int]:
        q = db.query(PMSInvoice).filter(
            PMSInvoice.branch_id == branch_id,
            PMSInvoice.tenant_id == tenant_id,
        )
        if series:
            q = q.filter(PMSInvoice.series == series)
        if fiscal_year:
            q = q.filter(PMSInvoice.fiscal_year == fiscal_year)
        total = q.count()
        rows = q.order_by(PMSInvoice.issued_at.desc()).offset(offset).limit(limit).all()
        return rows, total

    @staticmethod
    def count_reprints(db: Session, original_id: str) -> int:
        return (
            db.query(PMSInvoice)
            .filter(PMSInvoice.reprint_of == original_id)
            .count()
        )
