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
