from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import get_current_user, require_role
from utils.helpers import success_response, error_response
from features.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    UserData,
    GoogleCallbackRequest,
    GoogleCompleteRequest,
    CreateTeamMemberRequest,
)
from features.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    result = AuthService.register_tenant(db, data)

    if not result["success"]:
        if result["error_code"] == "EMAIL_ALREADY_EXISTS":
            return error_response(
                "EMAIL_ALREADY_EXISTS",
                "This email is already registered",
                400,
            )
        return error_response(
            "REGISTRATION_FAILED",
            "Failed to create account",
            500,
        )

    return success_response(
        data={
            "user": result["user"].model_dump(),
            "tenant": result["tenant"].model_dump(),
            "tokens": result["tokens"],
        },
        message="Account created successfully",
        status_code=201,
    )


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    result = AuthService.login(db, data)

    if not result["success"]:
        return error_response(
            "INVALID_CREDENTIALS",
            "Invalid email or password",
            401,
        )

    if result.get("is_superadmin"):
        return success_response(
            data={
                "admin_id": result["admin_id"],
                "is_superadmin": True,
                "tokens": result["tokens"],
            },
            message="Login successful",
        )

    return success_response(
        data={
            "user": result["user"].model_dump(),
            "tokens": result["tokens"],
        },
        message="Login successful",
    )


@router.get("/me")
def get_current_user_info(
    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not current_user:
        return error_response(
            "UNAUTHORIZED",
            "Invalid or missing authentication token",
            401,
        )

    if current_user["type"] == "superadmin":
        admin = current_user["admin"]
        if not admin:
            return error_response(
                "UNAUTHORIZED",
                "Superadmin not found",
                401,
            )
        return success_response(
            data={
                "id": admin.id,
                "email": admin.email,
                "is_superadmin": True,
            },
        )

    user = current_user["user"]
    from features.auth.repository import TenantRepository

    tenant = TenantRepository.get_by_id(db, user.tenant_id)
    return success_response(
        data={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "picture_url": user.picture_url,
            "tenant_id": user.tenant_id,
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "pan": tenant.pan,
                "business_address": tenant.business_address,
                "business_phone": tenant.business_phone,
                "business_email": tenant.business_email,
            },
        },
    )


@router.post("/google/callback")
def google_callback(data: GoogleCallbackRequest, db: Session = Depends(get_db)):
    result = AuthService.google_callback(db, data.id_token)

    if not result["success"]:
        return error_response(
            "INVALID_TOKEN",
            "Invalid Google token",
            401,
        )

    if result.get("user_exists"):
        return success_response(
            data={
                "user_exists": True,
                "email": result["user"].email,
                "user": result["user"].model_dump(),
                "tokens": result["tokens"],
            },
            message="Login successful",
        )

    return success_response(
        data={
            "user_exists": False,
            "email": result["email"],
            "name": result["name"],
            "picture": result["picture"],
        },
        message="User does not exist, complete registration",
    )


@router.post("/google/complete")
def google_complete(data: GoogleCompleteRequest, db: Session = Depends(get_db)):
    result = AuthService.google_complete(
        db,
        data.email,
        data.full_name,
        data.business_name,
        data.pan,
        data.picture_url,
        data.business_address,
        data.business_phone,
        data.business_email,
    )

    if not result["success"]:
        if result["error_code"] == "EMAIL_ALREADY_EXISTS":
            return error_response(
                "EMAIL_ALREADY_EXISTS",
                "This email is already registered",
                400,
            )
        return error_response(
            "SIGNUP_FAILED",
            "Failed to create account",
            500,
        )

    return success_response(
        data={
            "user": result["user"].model_dump(),
            "tenant": result["tenant"].model_dump(),
            "tokens": result["tokens"],
        },
        message="Account created successfully",
        status_code=201,
    )


@router.post("/team-members")
def create_team_member(
    data: CreateTeamMemberRequest,
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    if current_user["type"] == "superadmin":
        return error_response(
            "INVALID_REQUEST",
            "Superadmin cannot create team members",
            400,
        )

    user = current_user["user"]
    result = AuthService.create_team_member(
        db, user.tenant_id, user.id, user.role, data.email, data.full_name, data.role
    )

    if not result["success"]:
        if result["error_code"] == "EMAIL_ALREADY_EXISTS":
            return error_response(
                "EMAIL_ALREADY_EXISTS",
                "This email is already registered",
                400,
            )
        elif result["error_code"] == "ROLE_NOT_ALLOWED":
            return error_response(
                "ROLE_NOT_ALLOWED",
                f"Your role cannot create {data.role} role",
                403,
            )
        return error_response(
            "CREATION_FAILED",
            "Failed to create team member",
            500,
        )

    return success_response(
        data={"user": result["user"].model_dump()},
        message="Team member created successfully",
        status_code=201,
    )
