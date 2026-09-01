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
from features.auth.repository import TenantRepository
from features.ims import purchase_txn_helpers as txn
from features.hotel_pms.audit_repository import AuditRepository
from utils.bikram_sambat import to_bs_iso, fiscal_year_from_ad, format_invoice_number
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

    # Round to cents now, before this feeds any paid/due comparison or gets
    # stored — raw Decimal division (line_vat, vat_amount above) can carry
    # more than 2 decimal places, so an unrounded total_amount could sit a
    # fraction of a cent above what actually gets stored in the
    # numeric(12,2) column. That mismatch made a fully-paid invoice
    # (paid_amount == total_amount once both are stored/rounded) compare as
    # `capped_paid >= totals["total"]` == False at write time, since the
    # comparison ran against the unrounded total — landing status="partial"
    # with a displayed due of Rs 0.00 (bug found via a 2026-09-01 audit
    # session). Quantizing here, not just on the ORM columns, keeps the
    # comparison and the stored value in agreement.
    cents = Decimal("0.01")
    gross = gross.quantize(cents)
    discount_total = discount_total.quantize(cents)
    taxable_net = taxable_net.quantize(cents)
    exempt_net = exempt_net.quantize(cents)
    vat_amount = vat_amount.quantize(cents)
    total_amount = total_amount.quantize(cents)

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
    def register_print(db: Session, tenant_id: str, invoice_id: str, printed_by: str | None) -> dict:
        """Call once per actual print of an issued invoice — bumps the
        reprint counter and tells the caller whether THIS print is the
        original (no watermark) or a reprint ("Copy of Original (N)"). Not
        meaningful for a quotation, which isn't a real bill yet."""
        invoice = IMSInvoiceRepository.get_by_id(db, tenant_id, invoice_id)
        if not invoice:
            return {"success": False, "error_code": "DOCUMENT_NOT_FOUND"}
        if invoice.kind == "quotation":
            return {"success": True, "invoice": invoice, "is_reprint": False}
        invoice = IMSInvoiceRepository.register_print(db, invoice, printed_by)
        return {"success": True, "invoice": invoice, "is_reprint": invoice.is_reprint}

    @staticmethod
    def record_payment(
        db: Session,
        tenant_id: str,
        invoice_id: str,
        amount: Decimal,
        method: str,
        performed_by: str | None = None,
    ) -> dict:
        """Settle more of an already-issued invoice later — e.g. it was
        saved unpaid/partial at checkout and the customer pays afterward.
        Never touches line items or the original totals (IRD: Electronic
        Billing Procedure 2082, clause 6.3घ — issued transaction data can't
        be edited); this only adds a new payment on top, same as a second
        installment. Mirrors create()'s payment-received ledger entry."""
        invoice = IMSInvoiceRepository.get_by_id(db, tenant_id, invoice_id)
        if not invoice:
            return {"success": False, "error_code": "DOCUMENT_NOT_FOUND"}
        if invoice.kind == "quotation":
            return {"success": False, "error_code": "QUOTATION_NOT_PAYABLE"}
        if invoice.is_credit_note:
            return {"success": False, "error_code": "CREDIT_NOTE_NOT_PAYABLE"}
        if amount <= 0:
            return {"success": False, "error_code": "INVALID_AMOUNT"}
        due = invoice.total_amount - invoice.paid_amount
        if due <= 0:
            return {"success": False, "error_code": "ALREADY_PAID"}

        capped = min(amount, due)
        before_paid = invoice.paid_amount
        invoice.paid_amount = before_paid + capped
        invoice.status = "paid" if invoice.paid_amount >= invoice.total_amount else "partial"

        txn.create_ledger_entry(
            db,
            tenant_id=tenant_id,
            party_id=invoice.customer_id,
            date=datetime.utcnow(),
            description=f"Payment received ({method})",
            reference=invoice.number,
            debit=Decimal(0),
            credit=capped,
        )
        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="ims",
            entity_type="invoice",
            entity_id=invoice.id,
            action="record_payment",
            performed_by=performed_by or "unknown",
            performer_type="staff",
            after_state={
                "amount": float(capped),
                "method": method,
                "before_paid": float(before_paid),
                "after_paid": float(invoice.paid_amount),
            },
        )
        db.commit()
        db.refresh(invoice)
        return {"success": True, "invoice": invoice, "amount_applied": capped}

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
        terminal_ip: str | None = None,
    ) -> dict:
        if not BranchRepository.get_by_id(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        customer = IMSPartyRepository.get_by_id(db, tenant_id, customer_id)
        if not customer:
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

        # IRD: Electronic Billing Procedure 2082, Annexure-6's own abbreviated
        # ("संक्षिप्त कर बीजक") invoice template states outright: "दश हजार
        # रुपैयाँभन्दा बढी कर लाग्ने मूल्यको वस्तु वा सेवाको बिक्रीमा यो बीजक
        # जारी गरिने छैन" — this format cannot be issued for a sale whose
        # TAXABLE value exceeds Rs 10,000. show_vat_breakdown is a UI
        # preference; this is a hard legal ceiling on it, enforced
        # server-side (never trust a client-supplied show_vat_breakdown to
        # bypass it) using the same totals math the invoice is about to be
        # saved with, not a separate approximation.
        if not is_quotation and not show_breakdown:
            _precheck_totals = _compute_totals(lines, vat_registered, vat_rate)
            if _precheck_totals["taxable"] > Decimal("10000"):
                return {"success": False, "error_code": "ABBREVIATED_INVOICE_LIMIT_EXCEEDED"}

        # Stock is only actually deducted for a real sale (a quotation is a
        # price offer, no stock movement — see the loop below), so only real
        # sales need this check; quoting an out-of-stock item is fine.
        # Checked BEFORE any row is written, so a failing sale never leaves
        # a partial invoice/lines behind needing a rollback.
        if not is_quotation:
            stock_error = _check_stock_availability(db, tenant_id, branch_id, lines)
            if stock_error:
                return stock_error

        date_bs = to_bs_iso(date) or ""
        fy_str = fiscal_year_from_ad(date) or ""

        try:
            if is_quotation:
                # Quotations use a simple sequential QT number — no IRD serial.
                from sqlalchemy import func as _func
                from shared_models import IMSInvoice as _IMSInvoice
                seq = (
                    db.query(_func.count(_IMSInvoice.id))
                    .filter(
                        _IMSInvoice.tenant_id == tenant_id,
                        _IMSInvoice.kind == "quotation",
                    )
                    .scalar() or 0
                ) + 1
                number = f"QT-{seq:04d}"
            else:
                series = "INV"
                serial = IMSInvoiceRepository.next_serial(db, branch_id, fy_str, series)
                number = format_invoice_number(series, fy_str, serial)

            # ── Seller snapshot (IRD: captured at issue time) ────────────────
            tenant = TenantRepository.get_by_id(db, tenant_id)
            branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
            seller_name = tenant.name if tenant else None
            seller_address = branch.address if branch else None
            seller_pan = tenant.pan if tenant else None
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
                seller_name=seller_name,
                seller_address=seller_address,
                seller_pan=seller_pan,
                buyer_name=customer.name,
                buyer_pan=customer.pan,
                buyer_address=customer.address,
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

        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="ims",
            entity_type="invoice",
            entity_id=invoice.id,
            action="create",
            performed_by=user_id,
            performer_type="user",
            after_state={"number": invoice.number, "total": float(invoice.total_amount)},
            terminal_ip=terminal_ip,
        )
        db.commit()

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
        terminal_ip: str | None = None,
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

        # IRD: same Rs 10,000 taxable-value ceiling as create() — see that
        # function's matching comment for the exact Annexure-6 citation.
        if not show_breakdown:
            _precheck_lines = [
                {"variant_id": line.variant_id, "qty": line.qty, "rate": line.rate,
                 "discount": line.discount, "taxable": line.taxable}
                for line in invoice.lines
            ]
            _precheck_totals = _compute_totals(_precheck_lines, vat_registered, vat_rate)
            if _precheck_totals["taxable"] > Decimal("10000"):
                return {"success": False, "error_code": "ABBREVIATED_INVOICE_LIMIT_EXCEEDED"}

        # Same hard-block rule as create() — stock is only ever checked here
        # (not reserved at quote time), so re-validated fresh at conversion
        # since stock may have moved since the quote was made.
        lines_as_dicts_precheck = [
            {"variant_id": line.variant_id, "qty": line.qty} for line in invoice.lines
        ]
        stock_error = _check_stock_availability(db, tenant_id, invoice.branch_id, lines_as_dicts_precheck)
        if stock_error:
            return stock_error

        fy_str = fiscal_year_from_ad(invoice.date) or ""

        try:
            series = "INV"
            serial = IMSInvoiceRepository.next_serial(db, invoice.branch_id, fy_str, series)
            number = format_invoice_number(series, fy_str, serial)
            kind = "tax" if show_breakdown else "abbreviated"

            # Snapshot seller at conversion time (the actual sale moment).
            tenant = TenantRepository.get_by_id(db, tenant_id)
            branch = BranchRepository.get_by_id(db, tenant_id, invoice.branch_id)
            invoice.seller_name = tenant.name if tenant else invoice.seller_name
            invoice.seller_address = branch.address if branch else invoice.seller_address
            invoice.seller_pan = tenant.pan if tenant else invoice.seller_pan

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

        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="ims",
            entity_type="invoice",
            entity_id=invoice.id,
            action="convert_quotation",
            performed_by=user_id,
            performer_type="user",
            after_state={"number": invoice.number, "total": float(invoice.total_amount)},
            terminal_ip=terminal_ip,
        )
        db.commit()

        logger.info(f"IMS quotation converted: {invoice_id} -> {invoice.number}", extra={"tenant_id": tenant_id})
        return {"success": True, "invoice": IMSInvoiceRepository.get_by_id(db, tenant_id, invoice.id)}

    @staticmethod
    def issue_credit_note(
        db: Session,
        tenant_id: str,
        user_id: str,
        invoice_id: str,
        reason: str,
        terminal_ip: str | None = None,
    ) -> dict:
        original = IMSInvoiceRepository.get_by_id(db, tenant_id, invoice_id)
        if not original:
            return {"success": False, "error_code": "INVOICE_NOT_FOUND"}
        if original.kind not in ("tax", "abbreviated") or original.is_credit_note:
            return {"success": False, "error_code": "NOT_A_REGULAR_INVOICE"}

        fy_str = fiscal_year_from_ad(original.date) or ""

        try:
            serial = IMSInvoiceRepository.next_serial(db, original.branch_id, fy_str, "CN")
            cn_number = format_invoice_number("CN", fy_str, serial)

            cn = IMSInvoiceRepository.create(
                db,
                tenant_id=tenant_id,
                number=cn_number,
                kind=original.kind,
                date=original.date,
                date_bs=original.date_bs,
                fiscal_year_id=original.fiscal_year_id,
                branch_id=original.branch_id,
                customer_id=original.customer_id,
                seller_name=original.seller_name,
                seller_address=original.seller_address,
                seller_pan=original.seller_pan,
                buyer_name=original.buyer_name,
                buyer_pan=original.buyer_pan,
                buyer_address=original.buyer_address,
                gross_amount=-original.gross_amount,
                discount_amount=-original.discount_amount,
                taxable_amount=-original.taxable_amount,
                exempt_amount=-original.exempt_amount,
                vat_amount=-original.vat_amount,
                total_amount=-original.total_amount,
                payment_method=original.payment_method,
                paid_amount=-original.paid_amount,
                status="paid",
                note=reason,
                user_id=user_id,
                is_credit_note=True,
                original_invoice_id=original.id,
                note_reason=reason,
            )

            # Mirror each original line onto the credit note — negate qty
            # (not rate), so the printed document reads as "returned: -2 x
            # Widget @ Rs 50" rather than showing a bare total with no
            # items. rate/discount/tax_rate stay as the customer was
            # actually charged; only the quantity flips sign so line_gross
            # (rate - discount) * qty comes out negative and sums back to
            # the negated header totals above.
            #
            # Every credit note also restores the sold quantity back to
            # stock (explicit product decision — a billing-only correction
            # where goods never left is expected to go through a separate
            # manual stock adjustment, not silently skip the restore here).
            for line in original.lines:
                IMSInvoiceRepository.add_line(
                    db,
                    invoice_id=cn.id,
                    product_id=line.product_id,
                    variant_id=line.variant_id,
                    description=line.description,
                    qty=-line.qty,
                    unit_id=line.unit_id,
                    rate=line.rate,
                    discount=line.discount,
                    taxable=line.taxable,
                    tax_rate=line.tax_rate,
                    vat_amount=-line.vat_amount,
                )

                stock_row = txn.get_or_create_stock_row(db, line.variant_id, original.branch_id)
                balance = stock_row.qty + line.qty
                txn.set_stock_qty(db, stock_row, balance)
                txn.create_movement(
                    db,
                    tenant_id=tenant_id,
                    date=original.date,
                    date_bs=original.date_bs,
                    branch_id=original.branch_id,
                    product_id=line.product_id,
                    variant_id=line.variant_id,
                    type="return",
                    qty=line.qty,
                    balance_after=balance,
                    reference=cn_number,
                    user_id=user_id,
                )

            # Reverse the ledger entries.
            txn.create_ledger_entry(
                db,
                tenant_id=tenant_id,
                party_id=original.customer_id,
                date=original.date,
                description=f"Credit note {cn_number} reversal of {original.number}",
                reference=cn_number,
                debit=Decimal(0),
                credit=abs(original.total_amount),
            )
            if original.paid_amount > 0:
                txn.create_ledger_entry(
                    db,
                    tenant_id=tenant_id,
                    party_id=original.customer_id,
                    date=original.date,
                    description=f"Credit note refund ({original.payment_method})",
                    reference=cn_number,
                    debit=abs(original.paid_amount),
                    credit=Decimal(0),
                )

            db.commit()
            db.refresh(cn)
        except Exception as e:
            db.rollback()
            logger.error(f"IMS credit note failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="ims",
            entity_type="invoice",
            entity_id=original.id,
            action="credit_note",
            performed_by=user_id,
            performer_type="user",
            after_state={"credit_note_number": cn_number, "reason": reason},
            terminal_ip=terminal_ip,
        )
        db.commit()

        return {"success": True, "invoice": IMSInvoiceRepository.get_by_id(db, tenant_id, cn.id)}
