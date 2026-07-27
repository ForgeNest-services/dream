from sqlalchemy.orm import Session
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_google_token,
)
from core.roles import UserRole
from features.auth.repository import (
    TenantRepository,
    UserRepository,
    PlatformAdminRepository,
)
from features.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    UserData,
    TenantData,
    TokenData,
)
from utils.logger import logger
from utils.otp import generate_otp, store_otp, verify_otp


class AuthService:
    @staticmethod
    def register(db: Session, data: RegisterRequest) -> dict:
        existing_user = UserRepository.get_by_email(db, data.email)
        if existing_user:
            logger.warning(f"Registration failed: email already exists: {data.email}")
            return {"success": False, "error_code": "EMAIL_ALREADY_EXISTS"}

        try:
            password_hash = hash_password(data.password)

            user = UserRepository.create(
                db,
                tenant_id=None,
                full_name=data.full_name,
                email=data.email,
                password_hash=password_hash,
                is_owner=True,
                role=UserRole.OWNER,
            )
            logger.info(f"User created (unverified): {user.id}", extra={"email": data.email})

            otp = generate_otp()
            store_otp(user.id, otp, purpose="verification", ttl=60)
            logger.info(f"OTP generated for verification - {user.id}")

            return {
                "success": True,
                "user": UserData.model_validate(user),
                "otp_sent": True,
                "otp_code": otp,
                "message": "Verification email sent. Please verify your email.",
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Registration failed: {str(e)}")
            return {"success": False, "error_code": "REGISTRATION_FAILED"}

    @staticmethod
    def add_business_info(
        db: Session,
        email: str,
        business_name: str,
        business_address: str,
        pan: str = None,
        business_phone: str = None,
        business_email: str = None,
    ) -> dict:
        user = UserRepository.get_by_email(db, email)
        if not user:
            logger.warning(f"Business registration failed: user not found - {email}")
            return {"success": False, "error_code": "USER_NOT_FOUND"}

        if not user.is_verified:
            logger.warning(f"Business registration failed: email not verified - {email}")
            return {"success": False, "error_code": "EMAIL_NOT_VERIFIED"}

        if user.tenant_id:
            logger.warning(f"Business registration failed: tenant already exists - {email}")
            return {"success": False, "error_code": "TENANT_EXISTS"}

        try:
            tenant = TenantRepository.create(
                db,
                name=business_name,
                pan=pan,
                business_address=business_address,
                business_phone=business_phone,
                business_email=business_email,
            )
            logger.info(
                f"Tenant created: {tenant.id}",
                extra={"business_name": business_name},
            )

            user.tenant_id = tenant.id
            db.commit()
            logger.info(f"User linked to tenant: {user.id} -> {tenant.id}")

            tokens = AuthService._issue_tokens_for_user(user)

            return {
                "success": True,
                "user": UserData.model_validate(user),
                "tenant": TenantData.model_validate(tenant),
                "tokens": tokens,
                "message": "Business registered successfully",
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Business registration failed: {str(e)}")
            return {"success": False, "error_code": "BUSINESS_REGISTRATION_FAILED"}

    @staticmethod
    def login(db: Session, data: LoginRequest) -> dict:
        admin = PlatformAdminRepository.get_by_email(db, data.email)
        if admin and admin.is_active:
            if verify_password(data.password, admin.password_hash):
                tokens = AuthService._issue_tokens_for_superadmin(admin)
                logger.info(f"Superadmin login: {admin.email}")
                return {
                    "success": True,
                    "admin_id": admin.id,
                    "is_superadmin": True,
                    "tokens": tokens,
                }

        user = UserRepository.get_by_email(db, data.email)
        if user and user.is_active:
            if not user.is_verified:
                logger.warning(f"Login attempt with unverified email: {data.email}")
                return {"success": False, "error_code": "EMAIL_NOT_VERIFIED"}

            if verify_password(data.password, user.password_hash):
                tokens = AuthService._issue_tokens_for_user(user)
                logger.info(f"User login: {user.email}")
                return {
                    "success": True,
                    "user": UserData.model_validate(user),
                    "tokens": tokens,
                }

        logger.warning(f"Login failed: invalid credentials for {data.email}")
        return {"success": False, "error_code": "INVALID_CREDENTIALS"}

    @staticmethod
    def _issue_tokens_for_user(user) -> dict:
        access_token = create_access_token(
            {"user_id": user.id, "tenant_id": user.tenant_id, "is_owner": user.is_owner}
        )
        refresh_token = create_refresh_token(
            {"user_id": user.id, "tenant_id": user.tenant_id}
        )
        return TokenData(
            access_token=access_token,
            refresh_token=refresh_token,
        ).model_dump()

    @staticmethod
    def _issue_tokens_for_superadmin(admin) -> dict:
        access_token = create_access_token(
            {"admin_id": admin.id, "is_superadmin": True}
        )
        refresh_token = create_refresh_token(
            {"admin_id": admin.id, "is_superadmin": True}
        )
        return TokenData(
            access_token=access_token,
            refresh_token=refresh_token,
        ).model_dump()

    @staticmethod
    def google_callback(db: Session, id_token_str: str) -> dict:
        payload = verify_google_token(id_token_str)
        if not payload:
            logger.warning("Invalid Google token")
            return {"success": False, "error_code": "INVALID_TOKEN"}

        email = payload.get("email")
        user = UserRepository.get_by_email(db, email)

        if user and user.is_active:
            tokens = AuthService._issue_tokens_for_user(user)
            logger.info(f"Google login: {email}")
            return {
                "success": True,
                "user_exists": True,
                "user": UserData.model_validate(user),
                "tokens": tokens,
            }

        logger.info(f"New Google user: {email}")
        return {
            "success": True,
            "user_exists": False,
            "email": email,
            "name": payload.get("name"),
            "picture": payload.get("picture"),
        }

    @staticmethod
    def google_complete(
        db: Session,
        email: str,
        full_name: str,
        business_name: str,
        pan: str,
        picture_url: str = None,
        business_address: str = None,
        business_phone: str = None,
        business_email: str = None,
    ) -> dict:
        existing_user = UserRepository.get_by_email(db, email)
        if existing_user:
            logger.warning(f"Google signup failed: email already exists: {email}")
            return {"success": False, "error_code": "EMAIL_ALREADY_EXISTS"}

        try:
            tenant = TenantRepository.create(
                db,
                name=business_name,
                pan=pan,
                business_address=business_address,
                business_phone=business_phone,
                business_email=business_email,
            )
            logger.info(f"Tenant created: {tenant.id}", extra={"business_name": business_name})

            user = UserRepository.create(
                db,
                tenant_id=tenant.id,
                full_name=full_name,
                email=email,
                password_hash=None,
                is_owner=True,
                picture_url=picture_url,
                role=UserRole.OWNER,
            )
            user.is_verified = True
            db.commit()
            logger.info(f"Google user created and auto-verified: {user.id}", extra={"email": email})

            tokens = AuthService._issue_tokens_for_user(user)

            return {
                "success": True,
                "user": UserData.model_validate(user),
                "tenant": TenantData.model_validate(tenant),
                "tokens": tokens,
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Google signup failed: {str(e)}")
            return {"success": False, "error_code": "SIGNUP_FAILED"}

    @staticmethod
    def verify_otp(db: Session, email: str, otp_code: str) -> dict:
        user = UserRepository.get_by_email(db, email)
        if not user:
            logger.warning(f"OTP verification failed: user not found - {email}")
            return {"success": False, "error_code": "USER_NOT_FOUND"}

        if user.is_verified:
            logger.info(f"User already verified: {email}")
            return {"success": False, "error_code": "ALREADY_VERIFIED"}

        if verify_otp(user.id, otp_code, purpose="verification"):
            user.is_verified = True
            db.commit()
            logger.info(f"User verified: {email}")
            return {
                "success": True,
                "user": UserData.model_validate(user),
                "message": "Email verified successfully",
            }
        else:
            logger.warning(f"Invalid OTP for {email}")
            return {"success": False, "error_code": "INVALID_OTP"}

    @staticmethod
    def resend_verification_otp(db: Session, email: str) -> dict:
        user = UserRepository.get_by_email(db, email)
        if not user:
            logger.warning(f"Resend OTP failed: user not found - {email}")
            return {"success": False, "error_code": "USER_NOT_FOUND"}

        if user.is_verified:
            logger.info(f"User already verified: {email}")
            return {"success": False, "error_code": "ALREADY_VERIFIED"}

        otp = generate_otp()
        store_otp(user.id, otp, purpose="verification", ttl=60)
        logger.info(f"OTP resent for {email}")

        return {
            "success": True,
            "message": "Verification email sent",
            "otp_sent": True,
            "otp_code": otp,
        }

    @staticmethod
    def create_team_member(
        db: Session, tenant_id: str, caller_id: str, caller_role: str, email: str, full_name: str, role: str
    ) -> dict:
        existing_user = UserRepository.get_by_email(db, email)
        if existing_user:
            logger.warning(f"Team member creation failed: email already exists: {email}")
            return {"success": False, "error_code": "EMAIL_ALREADY_EXISTS"}

        allowed_roles = UserRole.get_roles_below(caller_role)

        if role not in allowed_roles:
            logger.warning(
                f"Team member creation failed: {caller_role} cannot create {role}",
                extra={"caller_role": caller_role, "requested_role": role},
            )
            return {"success": False, "error_code": "ROLE_NOT_ALLOWED"}

        try:
            user = UserRepository.create(
                db,
                tenant_id=tenant_id,
                full_name=full_name,
                email=email,
                password_hash=None,
                role=role,
                is_owner=False,
                owner_id=caller_id,
            )
            logger.info(
                f"Team member created: {user.id}",
                extra={"email": email, "role": role, "created_by": caller_id},
            )

            return {
                "success": True,
                "user": UserData.model_validate(user),
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Team member creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}
