from datetime import datetime
from core.crypto import decrypt_secret
from shared_models.org_tax_settings import OrgTaxSettings

# Credential storage lives in shared_models/org_tax_settings.py (one row per
# tenant, shared with RMS — see features/tax_settings/). Actual submission
# (HTTP call, response classification, retry) lives in
# api/jobs/cbms_jobs.py as an RQ job. This file keeps only what's genuinely
# IMS-specific: building the CBMS payload shape from an IMSInvoice.


def _fy_to_ird_format(fiscal_year: str) -> str:
    """Convert our '2081-82' format to IRD's '2081.082' format (dot-separated)."""
    if not fiscal_year or "-" not in fiscal_year:
        return fiscal_year or ""
    parts = fiscal_year.split("-")
    if len(parts) != 2:
        return fiscal_year
    start = parts[0].strip()   # "2081"
    end_short = parts[1].strip()  # "82"
    century = start[:2]  # "20"
    end_long = century + end_short.zfill(2)  # "2082" → use last 3 digits → "082"
    return f"{start}.{end_long[-3:]}"  # "2081.082"


def _fiscal_year_from_date_bs(date_bs: str) -> str:
    """Derive the fiscal year label (e.g. '2081-82') from a BS date string."""
    if not date_bs or len(date_bs) < 7:
        return ""
    bs_year = int(date_bs[:4])
    bs_month = int(date_bs[5:7])
    start_year = bs_year if bs_month >= 4 else bs_year - 1
    end_short = str(start_year + 1)[-2:]
    return f"{start_year}-{end_short}"


def build_cbms_payload(invoice, org: OrgTaxSettings) -> dict:
    """Build the exact IRD CBMS JSON payload."""
    date_ad = invoice.date
    date_str = date_ad.strftime("%Y.%m.%d") if date_ad else ""

    fy_label = _fiscal_year_from_date_bs(invoice.date_bs or "")
    fiscal_year = _fy_to_ird_format(fy_label)

    total_sales = float(invoice.total_amount or 0)
    taxable_sales_vat = float(invoice.taxable_amount or 0)
    vat = float(invoice.vat_amount or 0)
    tax_exempted_sales = float(invoice.exempt_amount or 0)

    return {
        "username": org.ird_username,
        "password": decrypt_secret(org.ird_password),
        "seller_pan": invoice.seller_pan or "",
        "buyer_pan": invoice.buyer_pan or "",
        "fiscal_year": fiscal_year,
        "buyer_name": invoice.buyer_name or "",
        "invoice_number": invoice.number or "",
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
        "isrealtime": False,
        "datetimeClient": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }


def build_credit_note_payload(credit_note, original_invoice, org: OrgTaxSettings) -> dict:
    """Build IRD CBMS payload for credit note — posted to /api/billreturn."""
    date_ad = credit_note.date
    date_str = date_ad.strftime("%Y.%m.%d") if date_ad else ""
    fy_label = _fiscal_year_from_date_bs(credit_note.date_bs or "")
    fiscal_year = _fy_to_ird_format(fy_label)

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
        "ref_invoice_number": original_invoice.number if original_invoice else "",
        "credit_note_number": credit_note.number or "",
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
        "isrealtime": False,
        "datetimeClient": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }
