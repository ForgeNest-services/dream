from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from utils.helpers import success_response, error_response
from features.auth.schemas import RegisterRequest, LoginRequest
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
