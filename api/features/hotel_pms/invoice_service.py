"""Invoice generation service — IRD Electronic Billing Procedure 2074.

Generates tax invoices directly from completed bookings.  The booking's
rate_per_night × nights is the single line item; future folio charges can be
added as additional line items once the folio system is built (Phase 6).

VAT rule (Nepal):
  If tenant.is_vat_registered → entire room charge is taxable at 13%.
  Otherwise               → non-taxable; vat_amount = 0.
"""
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from shared_models import PMSBooking, PMSGuest, PMSInvoice
from features.auth.repository import TenantRepository
from features.hotel_pms.invoice_repository import InvoiceRepository
from features.hotel_pms.audit_repository import AuditRepository
from utils.logger import logger

VAT_RATE = Decimal("0.13")
_TWO = Decimal("0.01")


def _round(v: Decimal) -> Decimal:
    return v.quantize(_TWO, rounding=ROUND_HALF_UP)


class InvoiceService:

    @staticmethod
    def generate_from_booking(
        db: Session,
        booking_id: str,
        tenant_id: str,
        performed_by: str,
        performer_type: str,
        terminal_ip: str | None = None,
    ) -> dict:
        booking: PMSBooking | None = (
            db.query(PMSBooking)
            .filter(PMSBooking.id == booking_id, PMSBooking.tenant_id == tenant_id)
            .first()
        )
        if not booking:
            return {"success": False, "error_code": "BOOKING_NOT_FOUND"}

        if booking.status not in ("checked_out", "checked_in"):
            return {"success": False, "error_code": "BOOKING_NOT_ELIGIBLE",
                    "detail": "Invoice can only be issued for checked-in or checked-out bookings."}

        # Prevent duplicate original invoices for the same booking
        existing = InvoiceRepository.get_by_booking(db, booking_id, tenant_id)
        if existing:
            return {"success": False, "error_code": "INVOICE_ALREADY_EXISTS",
                    "invoice": existing}

        tenant = TenantRepository.get_by_id(db, tenant_id)
        guest: PMSGuest = booking.guest

        # ── Seller snapshot ─────────────────────────────────────────────────
        seller_name = tenant.name
        seller_address = tenant.business_address
        seller_pan = tenant.pan
        seller_vat = bool(tenant.is_vat_registered)

        # ── Buyer snapshot ──────────────────────────────────────────────────
        buyer_name = guest.full_name
        buyer_pan = guest.pan
        buyer_address = None

        # ── Amounts ─────────────────────────────────────────────────────────
        nights = (booking.check_out_date - booking.check_in_date).days
        rate = Decimal(str(booking.rate_per_night))
        room_charge = _round(rate * nights)

        if seller_vat:
            taxable_amount = room_charge
            vat_amount = _round(taxable_amount * VAT_RATE)
            subtotal_amount = Decimal("0")
        else:
            taxable_amount = Decimal("0")
            vat_amount = Decimal("0")
            subtotal_amount = room_charge

        total_amount = subtotal_amount + taxable_amount + vat_amount

        room_number = booking.room.room_number if booking.room else "N/A"
        line_items = [
            {
                "description": f"Room {room_number} — {nights} night(s) @ NPR {rate:,.2f}",
                "quantity": nights,
                "unit_price": float(rate),
                "amount": float(room_charge),
                "taxable": seller_vat,
            }
        ]

        inv = InvoiceRepository.create(
            db,
            tenant_id=tenant_id,
            branch_id=booking.branch_id,
            booking_id=booking_id,
            series="INV",
            seller_name=seller_name,
            seller_address=seller_address,
            seller_pan=seller_pan,
            seller_is_vat_registered=seller_vat,
            buyer_name=buyer_name,
            buyer_pan=buyer_pan,
            buyer_address=buyer_address,
            subtotal_amount=subtotal_amount,
            taxable_amount=taxable_amount,
            vat_amount=vat_amount,
            total_amount=total_amount,
            line_items=line_items,
        )

        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="hotel_pms",
            entity_type="invoice",
            entity_id=inv.id,
            action="create",
            performed_by=performed_by,
            performer_type=performer_type,
            after_state={"invoice_number": inv.invoice_number, "total": float(total_amount)},
            terminal_ip=terminal_ip,
        )
        db.commit()

        logger.info(
            f"Invoice {inv.invoice_number} generated for booking {booking_id}",
            extra={"tenant_id": tenant_id},
        )
        return {"success": True, "invoice": inv}

    @staticmethod
    def reprint(
        db: Session,
        invoice_id: str,
        tenant_id: str,
        performed_by: str,
        performer_type: str,
        terminal_ip: str | None = None,
    ) -> dict:
        original = InvoiceRepository.get_by_id(db, invoice_id, tenant_id)
        if not original:
            return {"success": False, "error_code": "INVOICE_NOT_FOUND"}
        if original.is_reprint or original.original_invoice_id:
            return {"success": False, "error_code": "CANNOT_REPRINT_COPY"}

        count = InvoiceRepository.count_reprints(db, invoice_id)
        reprint_number = count + 1

        # Reprint is a new row — series/fiscal/serial unchanged from original,
        # invoice_number gets a "Copy" suffix to satisfy IRD watermark requirement.
        copy_number = f"{original.invoice_number}/Copy-{reprint_number}"

        inv = PMSInvoice(
            tenant_id=original.tenant_id,
            branch_id=original.branch_id,
            booking_id=original.booking_id,
            series=original.series,
            invoice_number=copy_number,
            fiscal_year=original.fiscal_year,
            serial_number=original.serial_number,
            seller_name=original.seller_name,
            seller_address=original.seller_address,
            seller_pan=original.seller_pan,
            seller_is_vat_registered=original.seller_is_vat_registered,
            buyer_name=original.buyer_name,
            buyer_pan=original.buyer_pan,
            buyer_address=original.buyer_address,
            subtotal_amount=original.subtotal_amount,
            taxable_amount=original.taxable_amount,
            vat_amount=original.vat_amount,
            total_amount=original.total_amount,
            line_items=original.line_items,
            is_reprint=True,
            reprint_of=original.id,
            reprint_number=reprint_number,
        )
        db.add(inv)

        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="hotel_pms",
            entity_type="invoice",
            entity_id=original.id,
            action="reprint",
            performed_by=performed_by,
            performer_type=performer_type,
            after_state={"reprint_number": reprint_number, "copy_number": copy_number},
            terminal_ip=terminal_ip,
        )
        db.commit()
        db.refresh(inv)
        return {"success": True, "invoice": inv}

    @staticmethod
    def issue_credit_note(
        db: Session,
        invoice_id: str,
        tenant_id: str,
        reason: str,
        performed_by: str,
        performer_type: str,
        terminal_ip: str | None = None,
    ) -> dict:
        original = InvoiceRepository.get_by_id(db, invoice_id, tenant_id)
        if not original:
            return {"success": False, "error_code": "INVOICE_NOT_FOUND"}
        if original.series != "INV" or original.original_invoice_id:
            return {"success": False, "error_code": "NOT_A_REGULAR_INVOICE"}

        # Credit note reverses the entire amount (negated line items)
        neg_items = [
            {**item, "amount": -item["amount"], "unit_price": -item["unit_price"]}
            for item in original.line_items
        ]

        cn = InvoiceRepository.create(
            db,
            tenant_id=tenant_id,
            branch_id=original.branch_id,
            booking_id=original.booking_id,
            series="CN",
            seller_name=original.seller_name,
            seller_address=original.seller_address,
            seller_pan=original.seller_pan,
            seller_is_vat_registered=original.seller_is_vat_registered,
            buyer_name=original.buyer_name,
            buyer_pan=original.buyer_pan,
            buyer_address=original.buyer_address,
            subtotal_amount=-original.subtotal_amount,
            taxable_amount=-original.taxable_amount,
            vat_amount=-original.vat_amount,
            total_amount=-original.total_amount,
            line_items=neg_items,
            original_invoice_id=invoice_id,
            note_reason=reason,
        )

        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="hotel_pms",
            entity_type="invoice",
            entity_id=invoice_id,
            action="credit_note",
            performed_by=performed_by,
            performer_type=performer_type,
            after_state={"credit_note_number": cn.invoice_number, "reason": reason},
            reason=reason,
            terminal_ip=terminal_ip,
        )
        db.commit()
        db.refresh(cn)
        return {"success": True, "invoice": cn}

    @staticmethod
    def list_for_branch(
        db: Session,
        branch_id: str,
        tenant_id: str,
        series: str | None = None,
        fiscal_year: str | None = None,
        page: int = 1,
        per_page: int = 25,
    ) -> dict:
        offset = (page - 1) * per_page
        rows, total = InvoiceRepository.list_for_branch(
            db, branch_id, tenant_id, series, fiscal_year, per_page, offset
        )
        return {"success": True, "invoices": rows, "total": total}

    @staticmethod
    def get(db: Session, invoice_id: str, tenant_id: str) -> dict:
        inv = InvoiceRepository.get_by_id(db, invoice_id, tenant_id)
        if not inv:
            return {"success": False, "error_code": "INVOICE_NOT_FOUND"}
        return {"success": True, "invoice": inv}
