import httpx
from sqlalchemy.orm import Session
from core.configs import settings
from utils.logger import logger

IRD_CBMS_URL = getattr(settings, "IRD_CBMS_URL", "http://202.166.207.75:9050/api/bill")
IRD_CBMS_RETURN_URL = getattr(settings, "IRD_CBMS_RETURN_URL", "http://202.166.207.75:9050/api/billreturn")


def _parse_ird_response(body: dict) -> tuple[bool, str, str]:
    """Shared response-shape parsing for both /api/bill and /api/billreturn —
    IRD's response is inconsistent about where status/code land."""
    ird_status = (
        (body.get("data") or {}).get("status")
        or body.get("status")
        or body.get("message")
        or "ok"
    )
    ird_code = body.get("code") or body.get("errorCode") or 200
    is_success = (
        str(ird_code) == "200"
        or (isinstance(ird_status, str) and "success" in ird_status.lower())
        or (isinstance(ird_status, str) and "ok" in ird_status.lower())
    )
    return is_success, str(ird_code), str(ird_status)


def post_to_cbms(url: str, payload: dict) -> dict:
    """POSTs a prebuilt CBMS payload and normalizes the response into
    {success, synced, ird_response} or {success: False, error_code, detail}.
    Shared by both IMS invoices and RMS orders — the wire format and status
    parsing are identical, only payload construction differs per app."""
    try:
        response = httpx.post(url, json=payload, timeout=15.0)
    except httpx.TimeoutException:
        return {"success": False, "error_code": "CBMS_TIMEOUT"}
    except Exception as e:
        logger.error(f"CBMS sync error: {e}")
        return {"success": False, "error_code": "CBMS_ERROR", "detail": str(e)}

    if response.status_code != 200:
        logger.error(f"CBMS sync failed: HTTP {response.status_code} {response.text[:200]}")
        return {
            "success": False,
            "error_code": "CBMS_HTTP_ERROR",
            "detail": f"HTTP {response.status_code}: {response.text[:200]}",
        }

    try:
        body = response.json()
    except Exception:
        body = {}

    is_success, ird_code, ird_status = _parse_ird_response(body)
    if not is_success:
        logger.error(f"CBMS rejected submission: code={ird_code} status={ird_status}")
        return {"success": False, "error_code": f"CBMS_REJECTED_{ird_code}", "detail": ird_status}
    return {"success": True, "synced": True, "ird_response": body}
