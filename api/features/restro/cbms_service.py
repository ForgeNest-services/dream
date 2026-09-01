from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.crypto import decrypt_secret
from features.cbms.credential_service import CBMSCredentialRepository, CBMSCredentialService
from features.cbms.submit import IRD_CBMS_URL, IRD_CBMS_RETURN_URL, post_to_cbms
from shared_models.ims_cbms_credential import IMSCbmsCredential
from utils.logger import logger

# Mirrors features/ims/cbms_service.py — same IRD payload shape, same
# credential store (features/cbms, shared across apps), different source
# model (RestroOrder instead of IMSInvoice). See that file for the format
# conversion helpers' reasoning.


def _fy_to_ird_format(fiscal_year: str) -> str:
    """Convert our '2081-82' format to IRD's '2081/082' format."""
    if not fiscal_year or "-" not in fiscal_year:
        return fiscal_year or ""
    parts = fiscal_year.split("-")
    if len(parts) != 2:
        return fiscal_year
    start = parts[0].strip()
    end_short = parts[1].strip()
    century = start[:2]
    end_long = century + end_short.zfill(2)
    return f"{start}/{end_long[-3:]}"


def build_cbms_payload(order, cred: IMSCbmsCredential) -> dict:
    """Build the exact IRD CBMS JSON payload for a paid RestroOrder."""
    date_ad = order.paid_at or order.placed_at
    date_str = date_ad.strftime("%Y.%m.%d") if date_ad else ""
    fiscal_year = _fy_to_ird_format(order.fiscal_year or "")

    total_sales = float(order.total_amount or 0)
    taxable_sales_vat = float(order.taxable_amount or 0)
    vat = float(order.vat_amount or 0)
    tax_exempted_sales = float(order.exempt_amount or 0)

    return {
        "username": cred.ird_username,
        "password": decrypt_secret(cred.ird_password),
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
        "isrealtime": True,
        "datetimeClient": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }


def build_credit_note_payload(credit_note, original_order, cred: IMSCbmsCredential) -> dict:
    """Build IRD CBMS payload for a credit note — posted to /api/billreturn."""
    date_ad = credit_note.paid_at or credit_note.placed_at
    date_str = date_ad.strftime("%Y.%m.%d") if date_ad else ""
    fiscal_year = _fy_to_ird_format(credit_note.fiscal_year or "")

    total_sales = abs(float(credit_note.total_amount or 0))
    taxable_sales_vat = abs(float(credit_note.taxable_amount or 0))
    vat = abs(float(credit_note.vat_amount or 0))
    tax_exempted_sales = abs(float(credit_note.exempt_amount or 0))

    original_date = original_order.paid_at or original_order.placed_at if original_order else None
    return {
        "username": cred.ird_username,
        "password": decrypt_secret(cred.ird_password),
        "seller_pan": credit_note.seller_pan or "",
        "buyer_pan": credit_note.buyer_pan or "",
        "fiscal_year": fiscal_year,
        "buyer_name": credit_note.buyer_name or "",
        "invoice_number": str(original_order.bill_number) if original_order else "",
        "invoice_date": original_date.strftime("%Y.%m.%d") if original_date else "",
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
        "isrealtime": True,
        "datetimeClient": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }


class RestroCBMSService:
    @staticmethod
    def get_credentials(db: Session, tenant_id: str) -> dict:
        return CBMSCredentialService.get_credentials(db, tenant_id)

    @staticmethod
    def save_credentials(db: Session, tenant_id: str, ird_username: str, ird_password: str) -> dict:
        return CBMSCredentialService.save_credentials(db, tenant_id, ird_username, ird_password)

    @staticmethod
    def sync_order(db: Session, order, tenant_id: str) -> dict:
        """Submit a paid order's bill to IRD CBMS."""
        cred = CBMSCredentialRepository.get(db, tenant_id)
        if not cred:
            return {"success": False, "error_code": "CBMS_NOT_CONFIGURED"}

        payload = build_cbms_payload(order, cred)
        result = post_to_cbms(IRD_CBMS_URL, payload)
        if result["success"]:
            db.execute(
                text("UPDATE public.restro_orders SET cbms_synced = TRUE, cbms_synced_at = NOW() WHERE id = :id"),
                {"id": order.id},
            )
            db.commit()
        return result

    @staticmethod
    def sync_credit_note(db: Session, credit_note, original_order, tenant_id: str) -> dict:
        """Submit a credit note to IRD CBMS /api/billreturn."""
        cred = CBMSCredentialRepository.get(db, tenant_id)
        if not cred:
            return {"success": False, "error_code": "CBMS_NOT_CONFIGURED"}

        payload = build_credit_note_payload(credit_note, original_order, cred)
        result = post_to_cbms(IRD_CBMS_RETURN_URL, payload)
        if result["success"]:
            db.execute(
                text("UPDATE public.restro_orders SET cbms_synced = TRUE, cbms_synced_at = NOW() WHERE id = :id"),
                {"id": credit_note.id},
            )
            db.commit()
        return result

    @staticmethod
    def get_payload(db: Session, order, tenant_id: str) -> dict:
        """Return the CBMS payload without submitting it (for preview/debug)."""
        cred = CBMSCredentialRepository.get(db, tenant_id)
        if not cred:
            return {"success": False, "error_code": "CBMS_NOT_CONFIGURED"}
        payload = build_cbms_payload(order, cred)
        payload["password"] = "••••••••"
        return {"success": True, "payload": payload}


def sync_order_background(order_id: str, tenant_id: str) -> None:
    """Called as a FastAPI BackgroundTask after mark-paid — creates its own
    DB session so it runs safely after the response has been sent."""
    from core.database import SessionLocal
    from features.restro.order_repository import OrderRepository
    db = SessionLocal()
    try:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if order and order.status == "paid" and not order.is_credit_note:
            result = RestroCBMSService.sync_order(db, order, tenant_id)
            if not result.get("success"):
                logger.warning(
                    f"Auto CBMS sync failed for order {order_id}: "
                    f"{result.get('error_code')} — {result.get('detail', '')}"
                )
    except Exception as e:
        logger.error(f"Auto CBMS sync background task error for {order_id}: {e}")
    finally:
        db.close()


def sync_credit_note_background(credit_note_id: str, original_order_id: str, tenant_id: str) -> None:
    """Background CBMS sync for credit notes."""
    from core.database import SessionLocal
    from features.restro.order_repository import OrderRepository
    db = SessionLocal()
    try:
        cn = OrderRepository.get_by_id(db, tenant_id, credit_note_id)
        original = OrderRepository.get_by_id(db, tenant_id, original_order_id) if original_order_id else None
        if cn:
            result = RestroCBMSService.sync_credit_note(db, cn, original, tenant_id)
            if not result.get("success"):
                logger.warning(
                    f"Auto CBMS CN sync failed for {credit_note_id}: "
                    f"{result.get('error_code')} — {result.get('detail', '')}"
                )
    except Exception as e:
        logger.error(f"Auto CBMS CN sync background error for {credit_note_id}: {e}")
    finally:
        db.close()
