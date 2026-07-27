from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import get_current_user
from utils.helpers import success_response, error_response
from features.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    UserData,
    GoogleCallbackRequest,
    GoogleCompleteRequest,
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
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    if not current_user:
        return error_response(
            "UNAUTHORIZED",
            "Invalid or missing authentication token",
            401,
        )

    if current_user["type"] == "superadmin":
        admin = current_user["admin"]
        return success_response(
            data={
                "id": admin.id,
                "email": admin.email,
                "is_superadmin": True,
            },
        )

    user = current_user["user"]
    return success_response(
        data=UserData.model_validate(user).model_dump(),
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
        db, data.email, data.full_name, data.business_name, data.picture_url
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
