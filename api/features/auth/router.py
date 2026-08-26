from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import get_current_user, require_role, require_tenant_user
from core.queue import job_queue
from utils.helpers import success_response, error_response
from features.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    UserData,
    GoogleCallbackRequest,
    GoogleCompleteRequest,
    CreateTeamMemberRequest,
    VerifyOTPRequest,
    ResendOTPRequest,
    BusinessRegisterRequest,
    UpdateTaxInfoRequest,
    ChooseFreeAppRequest,
)
from features.auth.service import AuthService
from features.auth.repository import UserRepository
from jobs.email_jobs import send_team_invitation_email, send_otp_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    result = AuthService.register(db, data)

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

    if result.get("otp_sent"):
        job_queue.enqueue(
            send_otp_verification_email,
            recipient_email=result["user"].email,
            recipient_name=result["user"].full_name,
            otp_code=result["otp_code"],
            expiry_minutes=5,
        )

    return success_response(
        data={
            "user": result["user"].model_dump(),
            "otp_expires_in": 300,
        },
        message="Account created. Please verify your email with the OTP sent.",
        status_code=201,
    )


@router.post("/business-register")
def business_register(
    data: BusinessRegisterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user:
        return error_response(
            "UNAUTHORIZED",
            "Please login first",
            401,
        )

    if current_user["type"] == "superadmin":
        return error_response(
            "INVALID_REQUEST",
            "Superadmin cannot register business",
            400,
        )

    user = current_user["user"]
    result = AuthService.add_business_info(
        db,
        user.email,
        data.business_name,
        data.business_address,
        data.pan,
        data.is_vat_registered,
        data.business_phone,
        data.business_email,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "USER_NOT_FOUND":
            return error_response("USER_NOT_FOUND", "User not found", 404)
        if code == "EMAIL_NOT_VERIFIED":
            return error_response("EMAIL_NOT_VERIFIED", "Please verify email first", 400)
        if code == "TENANT_EXISTS":
            return error_response("TENANT_EXISTS", "Business already registered", 400)
        if code == "PAN_ALREADY_REGISTERED":
            return error_response(
                "PAN_ALREADY_REGISTERED",
                "This PAN is already registered under another account.",
                409,
            )
        if code == "BUSINESS_EMAIL_ALREADY_REGISTERED":
            return error_response(
                "BUSINESS_EMAIL_ALREADY_REGISTERED",
                "This business email is already registered under another account.",
                409,
            )
        if code == "BUSINESS_PHONE_ALREADY_REGISTERED":
            return error_response(
                "BUSINESS_PHONE_ALREADY_REGISTERED",
                "This business phone is already registered under another account.",
                409,
            )
        return error_response(
            "BUSINESS_REGISTRATION_FAILED",
            "Failed to register business",
            500,
        )

    return success_response(
        data={
            "user": result["user"].model_dump(),
            "tenant": result["tenant"].model_dump(),
            "tokens": result["tokens"],
        },
        message="Business registered successfully",
        status_code=201,
    )


@router.patch("/business-tax-info")
def update_business_tax_info(
    data: UpdateTaxInfoRequest,
    current_user: dict = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = AuthService.update_tax_info(
        db,
        tenant_id=user.tenant_id,
        pan=data.pan,
        is_vat_registered=data.is_vat_registered,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "TENANT_NOT_FOUND":
            return error_response("TENANT_NOT_FOUND", "Business not found.", 404)
        if code == "PAN_ALREADY_REGISTERED":
            return error_response(
                "PAN_ALREADY_REGISTERED",
                "This PAN is already registered under another account.",
                409,
            )
        return error_response("UPDATE_FAILED", "Failed to update tax info.", 500)

    return success_response(
        data={"tenant": result["tenant"].model_dump()},
        message="Tax info updated",
    )


@router.post("/verify-otp")
def verify_otp(data: VerifyOTPRequest, db: Session = Depends(get_db)):
    result = AuthService.verify_otp(db, data.email, data.otp_code)

    if not result["success"]:
        if result["error_code"] == "USER_NOT_FOUND":
            return error_response("USER_NOT_FOUND", "User not found", 404)
        elif result["error_code"] == "ALREADY_VERIFIED":
            return error_response("ALREADY_VERIFIED", "Email already verified", 400)
        elif result["error_code"] == "INVALID_OTP":
            return error_response("INVALID_OTP", "Invalid or expired OTP", 401)
        return error_response("VERIFICATION_FAILED", "Failed to verify email", 500)

    user = UserRepository.get_by_email(db, data.email)
    tokens = AuthService._issue_tokens_for_user(user)

    return success_response(
        data={
            "user": result.get("user", UserData.model_validate(user)).model_dump(),
            "tokens": tokens,
        },
        message="Email verified successfully. Proceed to register business details.",
    )


@router.post("/resend-verification-otp")
def resend_verification_otp(data: ResendOTPRequest, db: Session = Depends(get_db)):
    result = AuthService.resend_verification_otp(db, data.email)

    if not result["success"]:
        if result["error_code"] == "USER_NOT_FOUND":
            return error_response("USER_NOT_FOUND", "User not found", 404)
        elif result["error_code"] == "ALREADY_VERIFIED":
            return error_response("ALREADY_VERIFIED", "Email already verified", 400)
        return error_response("RESEND_FAILED", "Failed to resend OTP", 500)

    if result.get("otp_sent"):
        user = UserRepository.get_by_email(db, data.email)
        job_queue.enqueue(
            send_otp_verification_email,
            recipient_email=user.email,
            recipient_name=user.full_name,
            otp_code=result["otp_code"],
            expiry_minutes=5,
        )

    return success_response(
        data={"otp_expires_in": 300},
        message="Verification email sent",
    )


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    result = AuthService.login(db, data)

    if not result["success"]:
        error_code = result.get("error_code", "INVALID_CREDENTIALS")
        if error_code == "USER_NOT_FOUND":
            return error_response(
                "USER_NOT_FOUND",
                "No account found with this email. Please register first.",
                404,
            )
        if error_code == "EMAIL_NOT_VERIFIED":
            return error_response(
                "EMAIL_NOT_VERIFIED",
                "Please verify your email before logging in.",
                403,
            )
        if error_code == "ACCOUNT_INACTIVE":
            return error_response(
                "ACCOUNT_INACTIVE",
                "Your account is inactive. Please contact support.",
                403,
            )
        return error_response(
            "INVALID_CREDENTIALS",
            "Incorrect password. Please try again.",
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
            "tenant": result["tenant"].model_dump() if result.get("tenant") else None,
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

    response_data = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "picture_url": user.picture_url,
        "tenant_id": user.tenant_id,
    }

    if user.tenant_id:
        tenant = TenantRepository.get_by_id(db, user.tenant_id)
        if tenant:
            response_data["tenant"] = {
                "id": tenant.id,
                "name": tenant.name,
                "pan": tenant.pan,
                "is_vat_registered": tenant.is_vat_registered,
                "business_address": tenant.business_address,
                "business_phone": tenant.business_phone,
                "business_email": tenant.business_email,
                "free_app_code": tenant.free_app_code,
            }

    return success_response(data=response_data)


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
                "tenant": result["tenant"].model_dump() if result.get("tenant") else None,
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
        email=data.email,
        full_name=data.full_name,
        picture_url=data.picture_url,
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
            "tokens": result["tokens"],
        },
        message="Account created — please complete your business setup.",
        status_code=201,
    )


@router.post("/choose-free-app")
def choose_free_app(
    data: ChooseFreeAppRequest,
    current_user: dict = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = AuthService.choose_free_app(db, user.tenant_id, data.app_code)

    if not result["success"]:
        code = result["error_code"]
        if code == "FREE_APP_ALREADY_CHOSEN":
            return error_response("FREE_APP_ALREADY_CHOSEN", "You have already chosen your free app.", 409)
        if code == "APP_NOT_FOUND":
            return error_response("APP_NOT_FOUND", "App not found or inactive.", 404)
        if code == "TENANT_NOT_FOUND":
            return error_response("TENANT_NOT_FOUND", "Business not found.", 404)
        return error_response("CHOOSE_FAILED", "Failed to set free app.", 500)

    return success_response(
        data={"tenant": result["tenant"].model_dump()},
        message="Free app selected. Your 30-day trial has started!",
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

    # Queue invitation email as background job
    from features.auth.repository import TenantRepository

    tenant = TenantRepository.get_by_id(db, user.tenant_id)
    invitation_link = f"http://localhost:8000/invite?email={data.email}&token=TODO"

    job_queue.enqueue(
        send_team_invitation_email,
        recipient_email=data.email,
        recipient_name=data.full_name,
        invited_by=user.full_name,
        business_name=tenant.name,
        role=data.role,
        invitation_link=invitation_link,
    )

    return success_response(
        data={"user": result["user"].model_dump()},
        message="Team member created successfully, invitation email sent",
        status_code=201,
    )
