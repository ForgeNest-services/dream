from datetime import datetime, timezone, timedelta
from core.security import create_access_token, decode_token

APP_MODULE = "hotel_pms"
STAFF_TOKEN_TTL_HOURS = 8


def issue_staff_token(
    tenant_id: str, role: str, cred_id: str
) -> tuple[str, datetime]:
    expires_delta = timedelta(hours=STAFF_TOKEN_TTL_HOURS)
    expires_at = datetime.now(timezone.utc) + expires_delta
    token = create_access_token(
        {
            "tenant_id": tenant_id,
            "role": role,
            "cred_id": cred_id,
            "module": APP_MODULE,
        },
        expires_delta=expires_delta,
    )
    return token, expires_at


def decode_staff_token(token: str) -> dict | None:
    payload = decode_token(token)
    if not payload:
        return None
    if payload.get("module") != APP_MODULE:
        return None
    if not payload.get("cred_id") or not payload.get("tenant_id"):
        return None
    return payload
