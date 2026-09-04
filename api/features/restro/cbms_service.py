from datetime import datetime
from core.crypto import decrypt_secret
from shared_models.org_tax_settings import OrgTaxSettings

# Mirrors features/ims/cbms_service.py — same IRD payload shape, same
# credential store (shared_models/org_tax_settings.py, shared across
# apps), different source model (RestroOrder instead of IMSInvoice).
# Actual submission lives in api/jobs/cbms_jobs.py as an RQ job — this file
# keeps only payload construction.


def _fy_to_ird_format(fiscal_year: str) -> str:
    """Convert our '2081-82' format to IRD's '2081.082' format (dot-separated)."""
    if not fiscal_year or "-" not in fiscal_year:
        return fiscal_year or ""
    parts = fiscal_year.split("-")
    if len(parts) != 2:
        return fiscal_year
    start = parts[0].strip()
    end_short = parts[1].strip()
    century = start[:2]
    end_long = century + end_short.zfill(2)
    return f"{start}.{end_long[-3:]}"


def build_cbms_payload(order, org: OrgTaxSettings) -> dict:
    """Build the exact IRD CBMS JSON payload for a paid RestroOrder."""
    date_ad = order.paid_at or order.placed_at
    date_str = date_ad.strftime("%Y.%m.%d") if date_ad else ""
    fiscal_year = _fy_to_ird_format(order.fiscal_year or "")

    total_sales = float(order.total_amount or 0)
    taxable_sales_vat = float(order.taxable_amount or 0)
    vat = float(order.vat_amount or 0)
    tax_exempted_sales = float(order.exempt_amount or 0)

    return {
        "username": org.ird_username,
        "password": decrypt_secret(org.ird_password),
        "seller_pan": order.seller_pan or "",
        "buyer_pan": order.buyer_pan or "",
        "fiscal_year": fiscal_year,
        "buyer_name": order.buyer_name or "",
        "invoice_number": str(order.bill_number),
        "invoice_date": date_str,
        "total_sales": round(total_sales, 2),
        "taxable_sales_vat": round(taxable_sales_vat, 2),
        "vat": round(vat, 2),
        "excisable_amount": 0.00,
        "excise": 0.00,
        "taxable_sales_hst": 0.00,
        "hst": 0.00,
        "amount_for_esf": 0.00,
        "esf": 0.00,
        "export_sales": 0.00,
        "tax_exempted_sales": round(tax_exempted_sales, 2),
        "isrealtime": bool(order.is_realtime),
        "datetimeClient": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }


def build_credit_note_payload(credit_note, original_order, org: OrgTaxSettings) -> dict:
    """Build IRD CBMS payload for a credit note — posted to /api/billreturn."""
    date_ad = credit_note.paid_at or credit_note.placed_at
    date_str = date_ad.strftime("%Y.%m.%d") if date_ad else ""
    fiscal_year = _fy_to_ird_format(credit_note.fiscal_year or "")

    total_sales = abs(float(credit_note.total_amount or 0))
    taxable_sales_vat = abs(float(credit_note.taxable_amount or 0))
    vat = abs(float(credit_note.vat_amount or 0))
    tax_exempted_sales = abs(float(credit_note.exempt_amount or 0))

    return {
        "username": org.ird_username,
        "password": decrypt_secret(org.ird_password),
        "seller_pan": credit_note.seller_pan or "",
        "buyer_pan": credit_note.buyer_pan or "",
        "fiscal_year": fiscal_year,
        "buyer_name": credit_note.buyer_name or "",
        "ref_invoice_number": str(original_order.bill_number) if original_order else "",
        "credit_note_number": str(credit_note.bill_number),
        "credit_note_date": date_str,
        "reason_for_return": credit_note.note_reason or "Credit note issued",
        "total_sales": round(total_sales, 2),
        "taxable_sales_vat": round(taxable_sales_vat, 2),
        "vat": round(vat, 2),
        "excisable_amount": 0.00,
        "excise": 0.00,
        "taxable_sales_hst": 0.00,
        "hst": 0.00,
        "amount_for_esf": 0.00,
        "esf": 0.00,
        "export_sales": 0.00,
        "tax_exempted_sales": round(tax_exempted_sales, 2),
        "isrealtime": bool(credit_note.is_realtime),
        "datetimeClient": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }
