from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from features.ims.invoice_repository import IMSInvoiceRepository
from features.ims.product_repository import IMSProductRepository
from features.ims.party_repository import IMSPartyRepository
from features.ims.fiscal_year_service import IMSFiscalYearService
from features.ims.fiscal_year_repository import IMSFiscalYearRepository
from features.ims.nepali_date import fiscal_year_start_for_bs_date
from features.ims.branch_settings_service import IMSBranchSettingsService
from features.branches.repository import BranchRepository
from features.ims import purchase_txn_helpers as txn
from utils.bikram_sambat import to_bs_iso
from utils.logger import logger


def _compute_totals(lines: list[dict], vat_registered: bool, vat_rate: Decimal) -> dict:
    """Mirrors lib/invoice.ts's computeTotals. rate is VAT-EXCLUSIVE (see
    docs/arch.md) — the same convention as IMSPurchaseLine.unit_cost and
    IMSVariant.selling_price. VAT is added on top of the taxable lines' net
    amount, never backed out of it — a line priced at 100 sells for 113 at
    13% VAT, not 100 total. Also returns each line's per-line vat_amount
    (line_gross * vat_rate / 100, 0 if not taxable/not vat_registered) so
    the caller can snapshot it on IMSInvoiceLine.vat_amount."""
    gross = Decimal(0)
    discount_total = Decimal(0)
    taxable_net = Decimal(0)
    exempt_net = Decimal(0)
    line_vats: list[Decimal] = []
    effective_rate = vat_rate if vat_registered else Decimal(0)
    for line in lines:
        qty = line["qty"]
        rate = line["rate"]
        discount = line.get("discount") or Decimal(0)
        taxable = line.get("taxable", True) is not False
        line_gross = (rate - discount) * qty
        gross += rate * qty
        discount_total += discount * qty
        if taxable and vat_registered:
            taxable_net += line_gross
            line_vat = (line_gross * effective_rate) / 100
        else:
            exempt_net += line_gross
            line_vat = Decimal(0)
        line_vats.append(line_vat)

    vat_amount = taxable_net * effective_rate / 100 if vat_registered else Decimal(0)
    total_amount = taxable_net + vat_amount + exempt_net

    return {
        "gross": gross,
        "discount": discount_total,
        "taxable": taxable_net,
        "exempt": exempt_net,
        "vat": vat_amount,
        "total": total_amount,
        "line_vats": line_vats,
        "effective_rate": effective_rate,
    }


def _check_stock_availability(
    db: Session, tenant_id: str, branch_id: str, lines: list[dict]
) -> dict | None:
    """Pre-pass over every line before any row is written — a sale must
    never take a variant's stock negative (see CLAUDE.md-equivalent
    decision: hard block, not a warning). Multiple lines for the same
    variant in one cart are summed together since they share one stock row.
    Returns an error dict if any line would oversell, else None."""
    requested: dict[str, Decimal] = {}
    for line in lines:
        requested[line["variant_id"]] = requested.get(line["variant_id"], Decimal(0)) + line["qty"]

    for variant_id, qty in requested.items():
        variant = IMSProductRepository.get_variant(db, tenant_id, variant_id)
        if not variant:
            return {"success": False, "error_code": "VARIANT_NOT_FOUND"}
        stock_row = next((r for r in variant.stock_rows if r.branch_id == branch_id), None)
        available = stock_row.qty if stock_row else Decimal(0)
        if qty > available:
            return {
                "success": False,
                "error_code": "INSUFFICIENT_STOCK",
                "message": (
                    f"Only {available} {variant.name} in stock, cannot sell {qty}."
                    if variant.name and variant.name != "Default"
                    else f"Only {available} in stock, cannot sell {qty}."
                ),
                "details": {
                    "variant_id": variant_id,
                    "product_name": variant.product.name if variant.product else None,
                    "variant_name": variant.name,
                    "available_qty": float(available),
                    "requested_qty": float(qty),
                },
            }
    return None


class IMSInvoiceService:
    @staticmethod
    def get(db: Session, tenant_id: str, invoice_id: str) -> dict:
        invoice = IMSInvoiceRepository.get_by_id(db, tenant_id, invoice_id)
        if not invoice:
            return {"success": False, "error_code": "DOCUMENT_NOT_FOUND"}
        return {"success": True, "invoice": invoice}

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
    ) -> dict:
        items, total = IMSInvoiceRepository.list_for_tenant(
            db, tenant_id, branch_id, customer_id, fiscal_year_id, status, kind, q, bs_from, bs_to, offset, limit
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
        invoice_prefix: str,
        is_quotation: bool = False,
        show_vat_breakdown: bool | None = None,
    ) -> dict:
        if not BranchRepository.get_by_id(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if not IMSPartyRepository.get_by_id(db, tenant_id, customer_id):
            return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}
        if not lines:
            return {"success": False, "error_code": "NO_ITEMS"}

        # vat_registered/vat_rate are NEVER trusted from the client — a
        # buggy or malicious caller could otherwise claim VAT isn't
        # registered (skipping tax on a real VAT-registered sale) or supply
        # a fake rate. Looked up server-side from the branch's own settings,
        # the same record GET /branches/{id}/settings reads from.
        settings_result = IMSBranchSettingsService.get_or_create(db, tenant_id, branch_id)
        if not settings_result["success"]:
            return settings_result
        branch_settings = settings_result["settings"]
        vat_registered = branch_settings.vat_enabled
        vat_rate = branch_settings.vat_rate

        # vat_registered always drives the REAL math below (VAT is genuinely
        # added on top of the exclusive rate whenever the business is
        # VAT-registered — the customer pays the same total either way).
        # show_vat_breakdown is a separate, display-only choice: an
        # "abbreviated" bill still has the same total_amount/vat_amount
        # stored on it, it's just not itemized on screen/print. Defaults to
        # vat_registered so callers that don't pass it (any non-POS caller)
        # keep the original one-flag behavior.
        show_breakdown = vat_registered if show_vat_breakdown is None else show_vat_breakdown

        # Stock is only actually deducted for a real sale (a quotation is a
        # price offer, no stock movement — see the loop below), so only real
        # sales need this check; quoting an out-of-stock item is fine.
        # Checked BEFORE any row is written, so a failing sale never leaves
        # a partial invoice/lines behind needing a rollback.
        if not is_quotation:
            stock_error = _check_stock_availability(db, tenant_id, branch_id, lines)
            if stock_error:
                return stock_error

        fy_result = IMSFiscalYearService.get_active(db, tenant_id)
        start_year = fy_result["fiscal_year"].start_year if fy_result["success"] else datetime.now().year

        try:
            seq = IMSInvoiceRepository.count_for_tenant(db, tenant_id) + 1
            number = f"QT-{1000 + seq}" if is_quotation else f"{invoice_prefix}-{start_year}-{1000 + seq}"
            date_bs = to_bs_iso(date) or ""
            kind = "quotation" if is_quotation else ("tax" if show_breakdown else "abbreviated")
            # Resolved from this invoice's OWN date, not the active fiscal
            # year — a backdated sale must land in the fiscal year its date
            # actually falls in (see nepali_date.fiscal_year_start_for_bs_date).
            fy = IMSFiscalYearRepository.get_or_create_by_start_year(
                db, tenant_id, fiscal_year_start_for_bs_date(date_bs)
            )

            invoice = IMSInvoiceRepository.create(
                db,
                tenant_id=tenant_id,
                number=number,
                kind=kind,
                date=date,
                date_bs=date_bs,
                fiscal_year_id=fy.id,
                branch_id=branch_id,
                customer_id=customer_id,
                gross_amount=Decimal(0),
                discount_amount=Decimal(0),
                taxable_amount=Decimal(0),
                exempt_amount=Decimal(0),
                vat_amount=Decimal(0),
                total_amount=Decimal(0),
                payment_method=payment_method,
                paid_amount=Decimal(0),
                status="unpaid",
                note=note,
                user_id=user_id,
            )

            totals = _compute_totals(lines, vat_registered, vat_rate)

            lines_written = 0
            for line, line_vat in zip(lines, totals["line_vats"]):
                variant = IMSProductRepository.get_variant(db, tenant_id, line["variant_id"])
                if not variant:
                    db.rollback()
                    return {"success": False, "error_code": "VARIANT_NOT_FOUND"}
                product = IMSProductRepository.get_by_id(db, tenant_id, variant.product_id)

                taxable = line.get("taxable", True) is not False
                IMSInvoiceRepository.add_line(
                    db,
                    invoice_id=invoice.id,
                    product_id=variant.product_id,
                    variant_id=variant.id,
                    description=f"{product.name if product else 'Item'} — {variant.name}",
                    qty=line["qty"],
                    unit_id=variant.unit_id,
                    rate=line["rate"],
                    discount=line.get("discount") or Decimal(0),
                    taxable=taxable,
                    tax_rate=totals["effective_rate"] if taxable else Decimal(0),
                    vat_amount=line_vat,
                )
                lines_written += 1

                # A quotation is a price offer only — no stock movement, no
                # ledger post. Those happen for real when it's converted
                # (see IMSInvoiceService.convert) or immediately below for a
                # normal (non-quotation) sale.
                if not is_quotation:
                    stock_row = txn.get_or_create_stock_row(db, variant.id, branch_id)
                    balance = stock_row.qty - line["qty"]
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
                        qty=-line["qty"],
                        balance_after=balance,
                        reference=number,
                        user_id=user_id,
                    )

            if lines_written == 0:
                db.rollback()
                return {"success": False, "error_code": "NO_ITEMS"}

            invoice.gross_amount = totals["gross"]
            invoice.discount_amount = totals["discount"]
            invoice.taxable_amount = totals["taxable"]
            invoice.exempt_amount = totals["exempt"]
            invoice.vat_amount = totals["vat"]
            invoice.total_amount = totals["total"]

            if is_quotation:
                # No payment, no ledger entry — a quotation hasn't been sold.
                invoice.status = "unpaid"
            else:
                capped_paid = min(paid_amount, totals["total"]) if paid_amount > 0 else Decimal(0)
                invoice.paid_amount = capped_paid
                invoice.status = (
                    "paid" if capped_paid >= totals["total"] and totals["total"] > 0
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
                    debit=totals["total"],
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

    @staticmethod
    def convert(
        db: Session,
        tenant_id: str,
        user_id: str,
        invoice_id: str,
        invoice_prefix: str,
        payment_method: str,
        paid_amount: Decimal,
        show_vat_breakdown: bool | None = None,
    ) -> dict:
        """Turns a quotation into a real invoice: re-numbers it, and applies
        the stock deduction + ledger posting that a quotation deliberately
        skips at creation time. Stock is re-checked at conversion time (not
        reserved at quote time), so this can fail if stock moved on since
        the quote was made — same risk any point-of-sale system has for an
        un-reserved quote."""
        invoice = IMSInvoiceRepository.get_by_id(db, tenant_id, invoice_id)
        if not invoice:
            return {"success": False, "error_code": "INVOICE_NOT_FOUND"}
        if invoice.kind != "quotation":
            return {"success": False, "error_code": "NOT_A_QUOTATION"}

        # vat_registered/vat_rate are looked up server-side, same as
        # IMSInvoiceService.create — never trusted from the client. Uses the
        # quotation's own branch, which VAT applies at conversion time (the
        # moment the sale actually happens), not whenever the quote was made.
        settings_result = IMSBranchSettingsService.get_or_create(db, tenant_id, invoice.branch_id)
        if not settings_result["success"]:
            return settings_result
        branch_settings = settings_result["settings"]
        vat_registered = branch_settings.vat_enabled
        vat_rate = branch_settings.vat_rate

        # See IMSInvoiceService.create's matching comment — vat_registered
        # drives the real math, show_vat_breakdown only picks "tax" vs
        # "abbreviated" for display/printing.
        show_breakdown = vat_registered if show_vat_breakdown is None else show_vat_breakdown

        fy_result = IMSFiscalYearService.get_active(db, tenant_id)
        start_year = fy_result["fiscal_year"].start_year if fy_result["success"] else datetime.now().year

        # Same hard-block rule as create() — stock is only ever checked here
        # (not reserved at quote time), so re-validated fresh at conversion
        # since stock may have moved since the quote was made.
        lines_as_dicts_precheck = [
            {"variant_id": line.variant_id, "qty": line.qty} for line in invoice.lines
        ]
        stock_error = _check_stock_availability(db, tenant_id, invoice.branch_id, lines_as_dicts_precheck)
        if stock_error:
            return stock_error

        try:
            seq = IMSInvoiceRepository.count_for_tenant(db, tenant_id) + 1
            number = f"{invoice_prefix}-{start_year}-{1000 + seq}"
            kind = "tax" if show_breakdown else "abbreviated"

            lines_as_dicts = [
                {
                    "variant_id": line.variant_id,
                    "qty": line.qty,
                    "rate": line.rate,
                    "discount": line.discount,
                    "taxable": line.taxable,
                }
                for line in invoice.lines
            ]

            totals = _compute_totals(lines_as_dicts, vat_registered, vat_rate)

            for line_dict, line, line_vat in zip(lines_as_dicts, invoice.lines, totals["line_vats"]):
                variant = IMSProductRepository.get_variant(db, tenant_id, line.variant_id)
                if not variant:
                    db.rollback()
                    return {"success": False, "error_code": "VARIANT_NOT_FOUND"}
                stock_row = txn.get_or_create_stock_row(db, variant.id, invoice.branch_id)
                balance = stock_row.qty - line_dict["qty"]
                txn.set_stock_qty(db, stock_row, balance)
                txn.create_movement(
                    db,
                    tenant_id=tenant_id,
                    date=invoice.date,
                    date_bs=invoice.date_bs,
                    branch_id=invoice.branch_id,
                    product_id=variant.product_id,
                    variant_id=variant.id,
                    type="sale",
                    qty=-line_dict["qty"],
                    balance_after=balance,
                    reference=number,
                    user_id=user_id,
                )
                # A quotation's lines are written with tax_rate/vat_amount at
                # 0 (no VAT applies to a price offer) — snapshot the real
                # values now that this is becoming a real, VAT-applicable sale.
                line.tax_rate = totals["effective_rate"] if line_dict["taxable"] else Decimal(0)
                line.vat_amount = line_vat

            capped_paid = min(paid_amount, totals["total"]) if paid_amount > 0 else Decimal(0)

            invoice.number = number
            invoice.kind = kind
            invoice.gross_amount = totals["gross"]
            invoice.discount_amount = totals["discount"]
            invoice.taxable_amount = totals["taxable"]
            invoice.exempt_amount = totals["exempt"]
            invoice.vat_amount = totals["vat"]
            invoice.total_amount = totals["total"]
            invoice.payment_method = payment_method
            invoice.paid_amount = capped_paid
            invoice.status = (
                "paid" if capped_paid >= totals["total"] and totals["total"] > 0
                else "partial" if capped_paid > 0
                else "unpaid"
            )

            txn.create_ledger_entry(
                db,
                tenant_id=tenant_id,
                party_id=invoice.customer_id,
                date=invoice.date,
                description=f"Sales invoice {number}",
                reference=number,
                debit=totals["total"],
                credit=Decimal(0),
            )
            if capped_paid > 0:
                txn.create_ledger_entry(
                    db,
                    tenant_id=tenant_id,
                    party_id=invoice.customer_id,
                    date=invoice.date,
                    description=f"Payment received ({payment_method})",
                    reference=number,
                    debit=Decimal(0),
                    credit=capped_paid,
                )

            db.commit()
            db.refresh(invoice)
        except Exception as e:
            db.rollback()
            logger.error(f"IMS quotation conversion failed: {str(e)}")
            return {"success": False, "error_code": "CONVERSION_FAILED"}

        logger.info(f"IMS quotation converted: {invoice_id} -> {invoice.number}", extra={"tenant_id": tenant_id})
        return {"success": True, "invoice": IMSInvoiceRepository.get_by_id(db, tenant_id, invoice.id)}
