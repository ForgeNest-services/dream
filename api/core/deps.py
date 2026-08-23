from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import decode_token
from shared_models import User, PlatformAdmin
from features.auth.repository import UserRepository, PlatformAdminRepository


def get_token_from_header(
    authorization: str = Header(None, include_in_schema=False),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization[7:]


def get_current_user(
    token: str = Depends(get_token_from_header), db: Session = Depends(get_db)
) -> dict:
    if not token:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    if payload.get("is_superadmin"):
        admin = PlatformAdminRepository.get_by_id(db, payload.get("admin_id"))
        if not admin:
            return None
        return {"type": "superadmin", "admin": admin}

    user_id = payload.get("user_id")
    if not user_id:
        return None

    user = UserRepository.get_by_id(db, user_id)
    if not user:
        return None

    return {"type": "user", "user": user}


def require_role(allowed_roles: list):
    def check(current_user: dict = Depends(get_current_user)):
        if not current_user:
            raise HTTPException(401, "Unauthorized")

        if current_user["type"] == "superadmin":
            return current_user

        user = current_user["user"]
        if user.role not in allowed_roles:
            raise HTTPException(403, "Insufficient permissions")

        return current_user

    return check


def require_platform_user(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user or current_user["type"] != "user":
        raise HTTPException(401, "Unauthorized")
    return current_user


def require_tenant_user(current_user: dict = Depends(require_platform_user)) -> dict:
    user = current_user["user"]
    if not user.tenant_id:
        raise HTTPException(
            403,
            {
                "error_code": "TENANT_REQUIRED",
                "message": "Complete business registration first",
            },
        )
    return current_user


def get_staff_token(
    authorization: str = Header(None, include_in_schema=False),
) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization[7:]


def _make_staff_dep(decode_fn):
    """Builds a require_<app>_staff dependency factory around an app's own
    decode_staff_token. Each app calls this with its own decode function so
    the module boundary stays a real, independent trust check (not just a
    shared string comparison) — if one app's staff auth needs to diverge
    later, only that app's wrapper changes."""

    def require_staff(role: str | None = None):
        def _dep(token: str = Depends(get_staff_token)) -> dict:
            if not token:
                raise HTTPException(401, "Unauthorized")

            payload = decode_fn(token)
            if not payload:
                raise HTTPException(401, "Invalid or expired token")

            staff_role = payload["role"]
            if role and staff_role != role:
                raise HTTPException(403, "Insufficient role")

            return {
                "tenant_id": payload["tenant_id"],
                "role": staff_role,
                "cred_id": payload.get("cred_id"),
                "branch_id": payload.get("branch_id"),
            }

        return _dep

    return require_staff


def require_hotel_pms_staff(role: str | None = None):
    from features.hotel_pms.auth import decode_staff_token

    return _make_staff_dep(decode_staff_token)(role)


def require_restro_staff(role: str | None = None):
    from features.restro.auth import decode_staff_token

    return _make_staff_dep(decode_staff_token)(role)


def require_ims_staff(role: str | None = None):
    from features.ims.auth import decode_staff_token

    return _make_staff_dep(decode_staff_token)(role)


def require_module_access(app_code: str):
    """Dependency factory that gates an endpoint behind an active subscription
    (trial or paid). Attach to any owner-level router to enforce billing.

    Usage:
        @router.get("/...", dependencies=[Depends(require_module_access("srota_pms"))])

    Currently intentionally NOT attached to any router — add when ready to
    enforce billing. The gate is built; flipping it on is a one-liner.
    """
    def _dep(current: dict = Depends(require_tenant_user), db: Session = Depends(get_db)):
        from features.subscriptions.service import SubscriptionService
        tenant_id = current["user"].tenant_id
        if not SubscriptionService.is_accessible(db, tenant_id, app_code):
            raise HTTPException(
                402,
                {
                    "error_code": "SUBSCRIPTION_REQUIRED",
                    "message": f"An active subscription or trial is required to access {app_code}.",
                },
            )
        return current

    return _dep


def require_tenant_scope(
    token: str = Depends(get_token_from_header),
    db: Session = Depends(get_db),
) -> dict:
    """Accepts EITHER a platform user JWT (owner/manager with tenant) OR any
    app-staff JWT (hotel_pms, restro, ...). Returns a normalized dict with
    `tenant_id`, `source` ("platform"|"staff"), and optionally `branch_id` for
    branch-scoped staff. Use this on endpoints that any authenticated tenant
    user should see (e.g. shared /branches list).
    """
    if not token:
        raise HTTPException(401, "Unauthorized")

    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")

    # Platform user path: has user_id and (via lookup) a tenant_id
    if "user_id" in payload:
        user = UserRepository.get_by_id(db, payload.get("user_id"))
        if not user or not user.tenant_id:
            raise HTTPException(403, "Tenant required")
        return {
            "tenant_id": user.tenant_id,
            "role": user.role,
            "source": "platform",
        }

    # App-staff path: has cred_id, module, tenant_id embedded
    if payload.get("cred_id") and payload.get("tenant_id"):
        return {
            "tenant_id": payload["tenant_id"],
            "role": payload.get("role"),
            "branch_id": payload.get("branch_id"),
            "module": payload.get("module"),
            "source": "staff",
        }

    raise HTTPException(401, "Unknown token type")
