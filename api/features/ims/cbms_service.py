import uuid
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.configs import settings
from core.crypto import encrypt_secret, decrypt_secret
from shared_models.ims_cbms_credential import IMSCbmsCredential
from utils.logger import logger

IRD_CBMS_URL = getattr(settings, "IRD_CBMS_URL", "http://202.166.207.75:9050/api/bill")
IRD_CBMS_RETURN_URL = getattr(settings, "IRD_CBMS_RETURN_URL", "http://202.166.207.75:9050/api/billreturn")


class CBMSCredentialRepository:
    @staticmethod
    def get(db: Session, tenant_id: str) -> IMSCbmsCredential | None:
        return db.query(IMSCbmsCredential).filter(
            IMSCbmsCredential.tenant_id == tenant_id,
            IMSCbmsCredential.is_active == True,
        ).first()

    @staticmethod
    def upsert(db: Session, tenant_id: str, ird_username: str, ird_password: str) -> IMSCbmsCredential:
        """ird_password is the tenant's real IRD Taxpayer Portal password —
        always stored encrypted (core/crypto.py), never in plaintext."""
        encrypted_password = encrypt_secret(ird_password)
        cred = db.query(IMSCbmsCredential).filter(
            IMSCbmsCredential.tenant_id == tenant_id
        ).first()
        if cred:
            cred.ird_username = ird_username
            cred.ird_password = encrypted_password
            cred.is_active = True
        else:
            cred = IMSCbmsCredential(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                ird_username=ird_username,
                ird_password=encrypted_password,
            )
            db.add(cred)
        db.flush()
        return cred


def _fy_to_ird_format(fiscal_year: str) -> str:
    """Convert our '2081-82' format to IRD's '2081/082' format."""
    if not fiscal_year or "-" not in fiscal_year:
        return fiscal_year or ""
    parts = fiscal_year.split("-")
    if len(parts) != 2:
        return fiscal_year
    start = parts[0].strip()   # "2081"
    end_short = parts[1].strip()  # "82"
    century = start[:2]  # "20"
    end_long = century + end_short.zfill(2)  # "2082" → use last 3 digits → "082"
    return f"{start}/{end_long[-3:]}"  # "2081/082"


def _fiscal_year_from_date_bs(date_bs: str) -> str:
    """Derive the fiscal year label (e.g. '2081-82') from a BS date string."""
    if not date_bs or len(date_bs) < 7:
        return ""
    bs_year = int(date_bs[:4])
    bs_month = int(date_bs[5:7])
    start_year = bs_year if bs_month >= 4 else bs_year - 1
    end_short = str(start_year + 1)[-2:]
    return f"{start_year}-{end_short}"


def build_cbms_payload(invoice, cred: IMSCbmsCredential) -> dict:
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
        "username": cred.ird_username,
        "password": decrypt_secret(cred.ird_password),
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
        "isrealtime": True,
        "datetimeClient": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }


def build_credit_note_payload(credit_note, original_invoice, cred: IMSCbmsCredential) -> dict:
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
        "username": cred.ird_username,
        "password": decrypt_secret(cred.ird_password),
        "seller_pan": credit_note.seller_pan or "",
        "buyer_pan": credit_note.buyer_pan or "",
        "fiscal_year": fiscal_year,
        "buyer_name": credit_note.buyer_name or "",
        "invoice_number": original_invoice.number if original_invoice else "",
        "invoice_date": original_invoice.date.strftime("%Y.%m.%d") if original_invoice and original_invoice.date else "",
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
        "isrealtime": True,
        "datetimeClient": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }


class CBMSService:
    @staticmethod
    def get_credentials(db: Session, tenant_id: str) -> dict:
        cred = CBMSCredentialRepository.get(db, tenant_id)
        if not cred:
            return {"success": False, "error_code": "CBMS_NOT_CONFIGURED"}
        return {
            "success": True,
            "credentials": {
                "ird_username": cred.ird_username,
                "ird_password": "••••••••",
                "is_active": cred.is_active,
            },
        }

    @staticmethod
    def save_credentials(db: Session, tenant_id: str, ird_username: str, ird_password: str) -> dict:
        try:
            CBMSCredentialRepository.upsert(db, tenant_id, ird_username, ird_password)
            db.commit()
            return {"success": True}
        except Exception as e:
            db.rollback()
            logger.error(f"CBMS credential save failed: {e}")
            return {"success": False, "error_code": "CBMS_SAVE_FAILED"}

    @staticmethod
    def sync_invoice(db: Session, invoice, tenant_id: str) -> dict:
        """Submit invoice to IRD CBMS. Returns {success, synced, error?}."""
        cred = CBMSCredentialRepository.get(db, tenant_id)
        if not cred:
            return {"success": False, "error_code": "CBMS_NOT_CONFIGURED"}

        payload = build_cbms_payload(invoice, cred)

        try:
            response = httpx.post(
                IRD_CBMS_URL,
                json=payload,
                timeout=15.0,
            )
            if response.status_code == 200:
                try:
                    body = response.json()
                except Exception:
                    body = {}
                # IRD response: {"data": {"status": "SUCCESS", ...}} or top-level code field
                ird_status = (
                    (body.get("data") or {}).get("status")
                    or body.get("status")
                    or body.get("message")
                    or "ok"
                )
                ird_code = body.get("code") or body.get("errorCode") or 200
                # Treat code 200 or status containing "success"/"ok" as success
                is_success = (
                    str(ird_code) == "200"
                    or (isinstance(ird_status, str) and "success" in ird_status.lower())
                    or (isinstance(ird_status, str) and "ok" in ird_status.lower())
                )
                if is_success:
                    db.execute(
                        text("UPDATE public.ims_invoices SET cbms_synced = TRUE, cbms_synced_at = NOW() WHERE id = :id"),
                        {"id": invoice.id},
                    )
                    db.commit()
                    return {"success": True, "synced": True, "ird_response": body}
                else:
                    logger.error(f"CBMS rejected invoice {invoice.id}: code={ird_code} status={ird_status}")
                    return {
                        "success": False,
                        "error_code": f"CBMS_REJECTED_{ird_code}",
                        "detail": str(ird_status),
                    }
            else:
                logger.error(f"CBMS sync failed: HTTP {response.status_code} {response.text[:200]}")
                return {
                    "success": False,
                    "error_code": "CBMS_HTTP_ERROR",
                    "detail": f"HTTP {response.status_code}: {response.text[:200]}",
                }
        except httpx.TimeoutException:
            return {"success": False, "error_code": "CBMS_TIMEOUT"}
        except Exception as e:
            logger.error(f"CBMS sync error: {e}")
            return {"success": False, "error_code": "CBMS_ERROR", "detail": str(e)}

    @staticmethod
    def sync_credit_note(db: Session, credit_note, original_invoice, tenant_id: str) -> dict:
        """Submit credit note to IRD CBMS /api/billreturn."""
        cred = CBMSCredentialRepository.get(db, tenant_id)
        if not cred:
            return {"success": False, "error_code": "CBMS_NOT_CONFIGURED"}

        payload = build_credit_note_payload(credit_note, original_invoice, cred)

        try:
            response = httpx.post(IRD_CBMS_RETURN_URL, json=payload, timeout=15.0)
            if response.status_code == 200:
                try:
                    body = response.json()
                except Exception:
                    body = {}
                ird_status = (body.get("data") or {}).get("status") or body.get("status") or "ok"
                ird_code = body.get("code") or 200
                is_success = str(ird_code) == "200" or (isinstance(ird_status, str) and "success" in ird_status.lower())
                if is_success:
                    db.execute(
                        text("UPDATE public.ims_invoices SET cbms_synced = TRUE, cbms_synced_at = NOW() WHERE id = :id"),
                        {"id": credit_note.id},
                    )
                    db.commit()
                    return {"success": True, "synced": True, "ird_response": body}
                else:
                    return {"success": False, "error_code": f"CBMS_REJECTED_{ird_code}", "detail": str(ird_status)}
            else:
                return {"success": False, "error_code": "CBMS_HTTP_ERROR", "detail": f"HTTP {response.status_code}"}
        except httpx.TimeoutException:
            return {"success": False, "error_code": "CBMS_TIMEOUT"}
        except Exception as e:
            logger.error(f"CBMS credit note sync error: {e}")
            return {"success": False, "error_code": "CBMS_ERROR", "detail": str(e)}

    @staticmethod
    def get_payload(db: Session, invoice, tenant_id: str) -> dict:
        """Return the CBMS payload without submitting it (for preview/debug)."""
        cred = CBMSCredentialRepository.get(db, tenant_id)
        if not cred:
            return {"success": False, "error_code": "CBMS_NOT_CONFIGURED"}
        payload = build_cbms_payload(invoice, cred)
        payload["password"] = "••••••••"
        return {"success": True, "payload": payload}


def sync_invoice_background(invoice_id: str, tenant_id: str) -> None:
    """Called as a FastAPI BackgroundTask after invoice creation — creates its
    own DB session so it runs safely after the response has been sent."""
    from core.database import SessionLocal
    from features.ims.invoice_repository import IMSInvoiceRepository
    db = SessionLocal()
    try:
        invoice = IMSInvoiceRepository.get_by_id(db, invoice_id, tenant_id)
        if invoice and invoice.kind in ("tax", "abbreviated"):
            result = CBMSService.sync_invoice(db, invoice, tenant_id)
            if not result.get("success"):
                logger.warning(
                    f"Auto CBMS sync failed for invoice {invoice_id}: "
                    f"{result.get('error_code')} — {result.get('detail', '')}"
                )
    except Exception as e:
        logger.error(f"Auto CBMS sync background task error for {invoice_id}: {e}")
    finally:
        db.close()


def sync_credit_note_background(credit_note_id: str, original_invoice_id: str, tenant_id: str) -> None:
    """Background CBMS sync for credit notes."""
    from core.database import SessionLocal
    from features.ims.invoice_repository import IMSInvoiceRepository
    db = SessionLocal()
    try:
        cn = IMSInvoiceRepository.get_by_id(db, credit_note_id, tenant_id)
        original = IMSInvoiceRepository.get_by_id(db, original_invoice_id, tenant_id) if original_invoice_id else None
        if cn:
            result = CBMSService.sync_credit_note(db, cn, original, tenant_id)
            if not result.get("success"):
                logger.warning(
                    f"Auto CBMS CN sync failed for {credit_note_id}: "
                    f"{result.get('error_code')} — {result.get('detail', '')}"
                )
    except Exception as e:
        logger.error(f"Auto CBMS CN sync background error for {credit_note_id}: {e}")
    finally:
        db.close()
