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

    user = UserRepository.get_by_id(db, payload.get("user_id"))
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


def require_hotel_pms_staff(role: str | None = None):
    from features.hotel_pms.auth import decode_staff_token

    def _dep(token: str = Depends(get_staff_token)) -> dict:
        if not token:
            raise HTTPException(401, "Unauthorized")

        payload = decode_staff_token(token)
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
