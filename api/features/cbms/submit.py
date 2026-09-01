import httpx
from core.configs import settings
from utils.logger import logger

IRD_CBMS_URL = settings.IRD_CBMS_URL
IRD_CBMS_RETURN_URL = settings.IRD_CBMS_RETURN_URL

# docs/Srota_IRD_Compliance_Checklist.md's exact per-code decision table.
# Each code maps to how a caller (the RQ sync job) should treat it — not
# just success/fail. "synced" means the document is genuinely accepted (or,
# for 101 on /api/bill, was already accepted on a prior attempt — same
# outcome). "retry" means transient, safe to auto-retry with backoff.
# "manual" means a human needs to look at it; retrying the same request
# won't help. "not_found" is 101/105 on /api/billreturn specifically —
# distinct from "manual" only in that no credential problem is implied.
CLASSIFICATION_SYNCED = "synced"
CLASSIFICATION_RETRY = "retry"
CLASSIFICATION_MANUAL = "manual"
CLASSIFICATION_AUTH_STALE = "auth_stale"  # code 100 specifically

_CODE_MEANING = {
    "200": "Success",
    "100": "Auth mismatch — credentials likely stale",
    "101": "Already exists (bill) / doesn't exist (return)",
    "102": "Exception during processing",
    "103": "Unknown error",
    "104": "Invalid payload structure",
    "105": "Bill doesn't exist (returns only)",
}


def classify_response(code: str, is_credit_note: bool) -> str:
    """Maps an IRD response code to what the caller should DO, per the
    checklist's table. is_credit_note distinguishes /api/billreturn's
    slightly different meaning for 101/105 from /api/bill's."""
    if code == "200":
        return CLASSIFICATION_SYNCED
    if code == "100":
        return CLASSIFICATION_AUTH_STALE
    if code == "101":
        # /api/bill: "already exists" -> the bill genuinely made it through
        # on a prior attempt, treat as synced (idempotent), not a fresh
        # failure. /api/billreturn: "doesn't exist" -> the credit note
        # itself was never accepted, needs a human, not a resend.
        return CLASSIFICATION_MANUAL if is_credit_note else CLASSIFICATION_SYNCED
    if code in ("102", "103"):
        return CLASSIFICATION_RETRY
    if code in ("104", "105"):
        return CLASSIFICATION_MANUAL
    # Anything undocumented — don't assume it's safe to retry forever.
    return CLASSIFICATION_MANUAL


def _parse_ird_response(body: dict) -> tuple[str, str]:
    """Extracts (code, status_message) from IRD's response body. IRD is
    inconsistent about where these land across endpoints/versions, so this
    checks several plausible shapes rather than assuming one."""
    ird_status = (
        (body.get("data") or {}).get("status")
        or body.get("status")
        or body.get("message")
        or ""
    )
    ird_code = body.get("code") or body.get("errorCode") or (
        (body.get("data") or {}).get("code")
    )
    if ird_code is None:
        # No explicit code field and an HTTP 200 — the checklist's sources
        # only document code-bearing responses, but be defensive: infer
        # success from a status string containing "success"/"ok", else
        # treat as an unknown/unclassified response (code "103"-equivalent,
        # safe to retry rather than silently swallowed as success).
        ird_code = "200" if isinstance(ird_status, str) and (
            "success" in ird_status.lower() or "ok" in ird_status.lower()
        ) else "103"
    return str(ird_code), str(ird_status)


def post_to_cbms(url: str, payload: dict, is_credit_note: bool = False) -> dict:
    """POSTs a prebuilt CBMS payload and returns a normalized result:
    {ok: bool (transport-level — did we get a parseable response at all),
     code: str, status_message: str, classification: str, raw_body: dict}
    A transport failure (timeout, network error, non-200 HTTP) is reported
    as code "103" (unknown error) with classification "retry" — same
    treatment as an application-level transient IRD error, since from the
    caller's perspective both are "try again later." Shared by both IMS
    invoices and RMS orders — the wire format and status parsing are
    identical, only payload construction differs per app."""
    try:
        response = httpx.post(url, json=payload, timeout=15.0)
    except httpx.TimeoutException:
        return {
            "ok": False, "code": "103", "status_message": "Request timed out",
            "classification": CLASSIFICATION_RETRY, "raw_body": {},
        }
    except Exception as e:
        logger.error(f"CBMS sync transport error: {e}")
        return {
            "ok": False, "code": "103", "status_message": str(e),
            "classification": CLASSIFICATION_RETRY, "raw_body": {},
        }

    if response.status_code != 200:
        logger.error(f"CBMS sync failed: HTTP {response.status_code} {response.text[:200]}")
        return {
            "ok": False, "code": "103",
            "status_message": f"HTTP {response.status_code}: {response.text[:200]}",
            "classification": CLASSIFICATION_RETRY, "raw_body": {},
        }

    try:
        body = response.json()
    except Exception:
        body = {}

    code, status_message = _parse_ird_response(body)
    classification = classify_response(code, is_credit_note)
    if classification not in (CLASSIFICATION_SYNCED,):
        logger.warning(
            f"CBMS response code {code} ({_CODE_MEANING.get(code, 'undocumented')}) "
            f"-> {classification}: {status_message}"
        )
    return {
        "ok": True, "code": code, "status_message": status_message,
        "classification": classification, "raw_body": body,
    }
