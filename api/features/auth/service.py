from sqlalchemy.orm import Session
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_google_token,
)
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


class AuthService:
    @staticmethod
    def register_tenant(db: Session, data: RegisterRequest) -> dict:
        existing_user = UserRepository.get_by_email(db, data.email)
        if existing_user:
            logger.warning(f"Registration failed: email already exists: {data.email}")
            return {"success": False, "error_code": "EMAIL_ALREADY_EXISTS"}

        try:
            tenant = TenantRepository.create(db, data.business_name)
            logger.info(
                f"Tenant created: {tenant.id}",
                extra={"business_name": data.business_name},
            )

            password_hash = hash_password(data.password)
            user = UserRepository.create(
                db,
                tenant_id=tenant.id,
                full_name=data.full_name,
                email=data.email,
                password_hash=password_hash,
                is_owner=True,
                role="owner",
            )
            logger.info(f"Owner user created: {user.id}", extra={"email": data.email})

            tokens = AuthService._issue_tokens_for_user(user)

            return {
                "success": True,
                "user": UserData.model_validate(user),
                "tenant": TenantData.model_validate(tenant),
                "tokens": tokens,
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Registration failed: {str(e)}")
            return {"success": False, "error_code": "REGISTRATION_FAILED"}

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
        db: Session, email: str, full_name: str, business_name: str, picture_url: str = None
    ) -> dict:
        existing_user = UserRepository.get_by_email(db, email)
        if existing_user:
            logger.warning(f"Google signup failed: email already exists: {email}")
            return {"success": False, "error_code": "EMAIL_ALREADY_EXISTS"}

        try:
            tenant = TenantRepository.create(db, business_name)
            logger.info(f"Tenant created: {tenant.id}", extra={"business_name": business_name})

            user = UserRepository.create(
                db,
                tenant_id=tenant.id,
                full_name=full_name,
                email=email,
                password_hash=None,
                is_owner=True,
                picture_url=picture_url,
                role="owner",
            )
            logger.info(f"Google user created: {user.id}", extra={"email": email})

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
