from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from features.ims.invoice_repository import IMSInvoiceRepository
from features.ims.product_repository import IMSProductRepository
from features.ims.party_repository import IMSPartyRepository
from features.ims.fiscal_year_service import IMSFiscalYearService
from features.branches.repository import BranchRepository
from features.ims import purchase_txn_helpers as txn
from utils.bikram_sambat import to_bs_iso
from utils.logger import logger


class IMSInvoiceService:
    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        customer_id: str | None,
        status: str | None,
        q: str | None,
        bs_from: str | None,
        bs_to: str | None,
        offset: int,
        limit: int,
    ) -> dict:
        items, total = IMSInvoiceRepository.list_for_tenant(
            db, tenant_id, branch_id, customer_id, status, q, bs_from, bs_to, offset, limit
        )
        return {"success": True, "invoices": items, "total": total}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        user_id: str,
        date: datetime,
        branch_id: str,
        customer_id: str,
        payment_method: str,
        paid_amount: Decimal,
        note: str | None,
        lines: list[dict],
        vat_registered: bool,
        vat_rate: Decimal,
        invoice_prefix: str,
    ) -> dict:
        if not BranchRepository.get_by_id(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if not IMSPartyRepository.get_by_id(db, tenant_id, customer_id):
            return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}
        if not lines:
            return {"success": False, "error_code": "NO_ITEMS"}

        fy_result = IMSFiscalYearService.get_active(db, tenant_id)
        start_year = fy_result["fiscal_year"].start_year if fy_result["success"] else datetime.now().year

        try:
            seq = IMSInvoiceRepository.count_for_tenant(db, tenant_id) + 1
            number = f"{invoice_prefix}-{start_year}-{1000 + seq}"
            date_bs = to_bs_iso(date) or ""
            kind = "tax" if vat_registered else "abbreviated"

            invoice = IMSInvoiceRepository.create(
                db,
                tenant_id=tenant_id,
                number=number,
                kind=kind,
                date=date,
                date_bs=date_bs,
                branch_id=branch_id,
                customer_id=customer_id,
                gross_amount=Decimal(0),
                discount_amount=Decimal(0),
                taxable_amount=Decimal(0),
                exempt_amount=Decimal(0),
                vat_amount=Decimal(0),
                total_amount=Decimal(0),
                payment_method=payment_method,
                paid_amount=paid_amount,
                status="unpaid",
                note=note,
                user_id=user_id,
            )

            gross = Decimal(0)
            discount_total = Decimal(0)
            taxable_net = Decimal(0)
            exempt_net = Decimal(0)
            lines_written = 0

            for line in lines:
                variant = IMSProductRepository.get_variant(db, tenant_id, line["variant_id"])
                if not variant:
                    db.rollback()
                    return {"success": False, "error_code": "VARIANT_NOT_FOUND"}
                product = IMSProductRepository.get_by_id(db, tenant_id, variant.product_id)

                qty = line["qty"]
                rate = line["rate"]
                discount = line.get("discount") or Decimal(0)
                taxable = line.get("taxable", True) is not False
                line_gross = (rate - discount) * qty

                gross += rate * qty
                discount_total += discount * qty
                if taxable:
                    taxable_net += line_gross
                else:
                    exempt_net += line_gross

                IMSInvoiceRepository.add_line(
                    db,
                    invoice_id=invoice.id,
                    product_id=variant.product_id,
                    variant_id=variant.id,
                    description=f"{product.name if product else 'Item'} — {variant.name}",
                    qty=qty,
                    unit_id=variant.unit_id,
                    rate=rate,
                    discount=discount,
                    taxable=taxable,
                )
                lines_written += 1

                stock_row = txn.get_or_create_stock_row(db, variant.id, branch_id)
                balance = stock_row.qty - qty
                txn.set_stock_qty(db, stock_row, balance)
                txn.create_movement(
                    db,
                    tenant_id=tenant_id,
                    date=date,
                    date_bs=date_bs,
                    branch_id=branch_id,
                    product_id=variant.product_id,
                    variant_id=variant.id,
                    type="sale",
                    qty=-qty,
                    balance_after=balance,
                    reference=number,
                    user_id=user_id,
                )

            if lines_written == 0:
                db.rollback()
                return {"success": False, "error_code": "NO_ITEMS"}

            # VAT-inclusive split — rate already includes VAT when the
            # tenant is registered, matching lib/invoice.ts's computeTotals.
            if vat_registered and vat_rate > 0:
                taxable_amount = taxable_net / (1 + vat_rate / 100)
                vat_amount = taxable_net - taxable_amount
            else:
                taxable_amount = taxable_net
                vat_amount = Decimal(0)
            total_amount = taxable_amount + vat_amount + exempt_net

            invoice.gross_amount = gross
            invoice.discount_amount = discount_total
            invoice.taxable_amount = taxable_amount
            invoice.exempt_amount = exempt_net
            invoice.vat_amount = vat_amount
            invoice.total_amount = total_amount
            capped_paid = min(paid_amount, total_amount) if paid_amount > 0 else Decimal(0)
            invoice.paid_amount = capped_paid
            invoice.status = (
                "paid" if capped_paid >= total_amount and total_amount > 0
                else "partial" if capped_paid > 0
                else "unpaid"
            )

            reference = number
            txn.create_ledger_entry(
                db,
                tenant_id=tenant_id,
                party_id=customer_id,
                date=date,
                description=f"Sales invoice {reference}",
                reference=reference,
                debit=total_amount,
                credit=Decimal(0),
            )
            if capped_paid > 0:
                txn.create_ledger_entry(
                    db,
                    tenant_id=tenant_id,
                    party_id=customer_id,
                    date=date,
                    description=f"Payment received ({payment_method})",
                    reference=reference,
                    debit=Decimal(0),
                    credit=capped_paid,
                )

            db.commit()
            db.refresh(invoice)
        except Exception as e:
            db.rollback()
            logger.error(f"IMS invoice creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

        logger.info(f"IMS invoice created: {invoice.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "invoice": IMSInvoiceRepository.get_by_id(db, tenant_id, invoice.id)}
