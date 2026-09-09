from datetime import timedelta
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from core.redis import redis_conn
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
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
from features.hotel_pms.audit_repository import AuditRepository
from utils.logger import logger
from utils.otp import generate_otp, store_otp, verify_otp

OTP_TTL_SECONDS = 300


class AuthService:
    @staticmethod
    def register(db: Session, data: RegisterRequest) -> dict:
        existing_user = UserRepository.get_by_email(db, data.email)

        # Verified accounts are truly taken — someone proved they own this email.
        if existing_user and existing_user.is_verified:
            logger.warning(f"Registration blocked: email already verified: {data.email}")
            return {"success": False, "error_code": "EMAIL_ALREADY_EXISTS"}

        try:
            password_hash = hash_password(data.password)

            if existing_user:
                # Unverified account exists — treat this as restarting verification.
                # Overwrite the password and name so whoever actually owns the email wins.
                existing_user.password_hash = password_hash
                existing_user.full_name = data.full_name
                db.commit()
                db.refresh(existing_user)
                user = existing_user
                logger.info(
                    f"Restarting verification for unverified account: {user.id}",
                    extra={"email": data.email},
                )
            else:
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
            store_otp(user.id, otp, purpose="verification", ttl=OTP_TTL_SECONDS)
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
        is_vat_registered: bool = False,
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
                is_vat_registered=is_vat_registered,
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

        except IntegrityError as e:
            db.rollback()
            msg = str(e.orig).lower() if e.orig else str(e).lower()
            logger.warning(f"Business registration integrity conflict: {msg}")
            if "pan" in msg:
                return {"success": False, "error_code": "PAN_ALREADY_REGISTERED"}
            if "business_email" in msg or "email" in msg:
                return {"success": False, "error_code": "BUSINESS_EMAIL_ALREADY_REGISTERED"}
            if "business_phone" in msg or "phone" in msg:
                return {"success": False, "error_code": "BUSINESS_PHONE_ALREADY_REGISTERED"}
            return {"success": False, "error_code": "BUSINESS_REGISTRATION_FAILED"}
        except Exception as e:
            db.rollback()
            logger.error(f"Business registration failed: {str(e)}")
            return {"success": False, "error_code": "BUSINESS_REGISTRATION_FAILED"}

    @staticmethod
    def update_tax_info(
        db: Session,
        tenant_id: str,
        pan: str = None,
        is_vat_registered: bool = None,
    ) -> dict:
        tenant = TenantRepository.get_by_id(db, tenant_id)
        if not tenant:
            return {"success": False, "error_code": "TENANT_NOT_FOUND"}

        try:
            updated = TenantRepository.update_tax_info(
                db, tenant, pan=pan, is_vat_registered=is_vat_registered
            )
            logger.info(f"Tenant tax info updated: {tenant_id}")
            return {"success": True, "tenant": TenantData.model_validate(updated)}
        except IntegrityError as e:
            db.rollback()
            msg = str(e.orig).lower() if e.orig else str(e).lower()
            logger.warning(f"Tax info update integrity conflict: {msg}")
            if "pan" in msg:
                return {"success": False, "error_code": "PAN_ALREADY_REGISTERED"}
            return {"success": False, "error_code": "UPDATE_FAILED"}
        except Exception as e:
            db.rollback()
            logger.error(f"Tax info update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    MAX_LOGO_BYTES = 5 * 1024 * 1024
    ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}

    @staticmethod
    def update_logo(
        db: Session,
        tenant_id: str,
        filename: str,
        content: bytes,
        content_type: str,
    ) -> dict:
        from core.storage import upload_file, delete_file, key_from_url

        if content_type not in AuthService.ALLOWED_LOGO_TYPES:
            return {"success": False, "error_code": "UNSUPPORTED_FILE_TYPE"}
        if len(content) > AuthService.MAX_LOGO_BYTES:
            return {"success": False, "error_code": "FILE_TOO_LARGE"}

        tenant = TenantRepository.get_by_id(db, tenant_id)
        if not tenant:
            return {"success": False, "error_code": "TENANT_NOT_FOUND"}

        old_key = key_from_url(tenant.logo_url) if tenant.logo_url else None
        url = upload_file(f"tenants/{tenant_id}/logo", filename, content, content_type)
        updated = TenantRepository.update_logo(db, tenant, url)
        if old_key:
            delete_file(old_key)
        logger.info(f"Tenant logo updated: {tenant_id}")
        return {"success": True, "tenant": TenantData.model_validate(updated)}

    @staticmethod
    def remove_logo(db: Session, tenant_id: str) -> dict:
        from core.storage import delete_file, key_from_url

        tenant = TenantRepository.get_by_id(db, tenant_id)
        if not tenant:
            return {"success": False, "error_code": "TENANT_NOT_FOUND"}

        key = key_from_url(tenant.logo_url) if tenant.logo_url else None
        updated = TenantRepository.update_logo(db, tenant, None)
        if key:
            delete_file(key)
        logger.info(f"Tenant logo removed: {tenant_id}")
        return {"success": True, "tenant": TenantData.model_validate(updated)}

    @staticmethod
    def login(db: Session, data: LoginRequest, terminal_ip: str | None = None) -> dict:
        admin = PlatformAdminRepository.get_by_email(db, data.email)
        if admin and admin.is_active:
            if verify_password(data.password, admin.password_hash):
                tokens = AuthService._issue_tokens_for_superadmin(admin)
                logger.info(f"Superadmin login: {admin.email}")
                # No tenant to attach an audit row to (AuditLog.tenant_id is
                # NOT NULL) — superadmin is Forgenest's own staff, outside
                # IRD's per-business activity-log scope anyway.
                return {
                    "success": True,
                    "admin_id": admin.id,
                    "is_superadmin": True,
                    "tokens": tokens,
                }

        user = UserRepository.get_by_email(db, data.email)
        if not user:
            logger.warning(f"Login failed: user not found for {data.email}")
            return {"success": False, "error_code": "USER_NOT_FOUND"}

        if not user.is_active:
            logger.warning(f"Login failed: inactive user {data.email}")
            return {"success": False, "error_code": "ACCOUNT_INACTIVE"}

        if not user.is_verified:
            logger.warning(f"Login attempt with unverified email: {data.email}")
            return {"success": False, "error_code": "EMAIL_NOT_VERIFIED"}

        if user.password_hash and verify_password(data.password, user.password_hash):
            tokens = AuthService._issue_tokens_for_user(user)
            logger.info(f"User login: {user.email}")

            tenant_data = None
            if user.tenant_id:
                tenant = TenantRepository.get_by_id(db, user.tenant_id)
                if tenant:
                    tenant_data = TenantData.model_validate(tenant)
                # IRD: Electronic Billing Procedure 2082, clause 6.3ख — all
                # user activity in the DB. Owner/Manager platform login is
                # in scope once a tenant (business) actually exists.
                AuditRepository.write(
                    db,
                    tenant_id=user.tenant_id,
                    app_code="platform",
                    entity_type="user",
                    entity_id=user.id,
                    action="login",
                    performed_by=user.id,
                    performer_type="platform_user",
                    after_state={"email": user.email, "role": user.role},
                    terminal_ip=terminal_ip,
                )
                db.commit()

            return {
                "success": True,
                "user": UserData.model_validate(user),
                "tenant": tenant_data,
                "tokens": tokens,
            }

        if user.tenant_id:
            AuditRepository.write(
                db,
                tenant_id=user.tenant_id,
                app_code="platform",
                entity_type="user",
                entity_id=user.id,
                action="login_failed",
                performed_by=user.id,
                performer_type="platform_user",
                after_state={"email": user.email},
                terminal_ip=terminal_ip,
            )
            db.commit()
        logger.warning(f"Login failed: invalid password for {data.email}")
        return {"success": False, "error_code": "INVALID_CREDENTIALS"}

    @staticmethod
    def logout(db: Session, user_id: str, tenant_id: str | None, terminal_ip: str | None = None) -> None:
        """No server-side session to invalidate (access token is short-lived
        and stateless; refresh token isn't revocation-tracked either) — this
        exists purely so the activity log has a real logout event."""
        if not tenant_id:
            return
        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="platform",
            entity_type="user",
            entity_id=user_id,
            action="logout",
            performed_by=user_id,
            performer_type="platform_user",
            terminal_ip=terminal_ip,
        )
        db.commit()

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
    def refresh_tokens(db: Session, refresh_token: str) -> dict:
        """Exchanges a still-valid refresh token for a new access+refresh
        pair. Mirrors the exact payload shape each login path already issues
        (see _issue_tokens_for_user / _issue_tokens_for_superadmin) — re-runs
        the same account-lookup + active checks a fresh login would, so a
        deactivated/deleted account can't keep refreshing forever."""
        payload = decode_token(refresh_token)
        if not payload:
            return {"success": False, "error_code": "INVALID_REFRESH_TOKEN"}

        if payload.get("is_superadmin"):
            admin = PlatformAdminRepository.get_by_id(db, payload.get("admin_id"))
            if not admin:
                return {"success": False, "error_code": "INVALID_REFRESH_TOKEN"}
            return {"success": True, "tokens": AuthService._issue_tokens_for_superadmin(admin)}

        user_id = payload.get("user_id")
        if not user_id:
            return {"success": False, "error_code": "INVALID_REFRESH_TOKEN"}
        user = UserRepository.get_by_id(db, user_id)
        if not user or not user.is_active:
            return {"success": False, "error_code": "INVALID_REFRESH_TOKEN"}
        return {"success": True, "tokens": AuthService._issue_tokens_for_user(user)}

    @staticmethod
    def google_callback(db: Session, id_token_str: str) -> dict:
        payload = verify_google_token(id_token_str)
        if not payload:
            logger.warning("Invalid Google token")
            return {"success": False, "error_code": "INVALID_TOKEN"}

        email = payload.get("email")
        user = UserRepository.get_by_email(db, email)

        if user and user.is_active:
            # Google just proved they own this email — promote unverified accounts.
            if not user.is_verified:
                user.is_verified = True
                if not user.picture_url:
                    user.picture_url = payload.get("picture")
                db.commit()
                db.refresh(user)
                logger.info(f"Google promoted unverified account: {email}")

            tokens = AuthService._issue_tokens_for_user(user)
            logger.info(f"Google login: {email}")

            tenant_data = None
            if user.tenant_id:
                tenant = TenantRepository.get_by_id(db, user.tenant_id)
                if tenant:
                    tenant_data = TenantData.model_validate(tenant)

            return {
                "success": True,
                "user_exists": True,
                "user": UserData.model_validate(user),
                "tenant": tenant_data,
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
        picture_url: str = None,
    ) -> dict:
        existing_user = UserRepository.get_by_email(db, email)
        if existing_user:
            logger.warning(f"Google signup failed: email already exists: {email}")
            return {"success": False, "error_code": "EMAIL_ALREADY_EXISTS"}

        try:
            user = UserRepository.create(
                db,
                tenant_id=None,
                full_name=full_name,
                email=email,
                password_hash=None,
                is_owner=True,
                picture_url=picture_url,
                role=UserRole.OWNER,
            )
            user.is_verified = True
            db.commit()
            logger.info(
                f"Google user created (pending business setup): {user.id}",
                extra={"email": email},
            )

            tokens = AuthService._issue_tokens_for_user(user)

            return {
                "success": True,
                "user": UserData.model_validate(user),
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
    def forgot_password(db: Session, email: str) -> dict:
        user = UserRepository.get_by_email(db, email)
        if not user:
            logger.warning(f"Forgot-password failed: user not found - {email}")
            return {"success": False, "error_code": "USER_NOT_FOUND"}

        # Google-only account (see google_callback/google_signup: password_hash
        # is never set for these) has no password to reset — sending an OTP
        # would just dead-end the user at a step they can't complete.
        if not user.password_hash:
            return {"success": False, "error_code": "GOOGLE_ACCOUNT"}

        otp = generate_otp()
        store_otp(user.id, otp, purpose="password_reset", ttl=OTP_TTL_SECONDS)
        logger.info(f"Password reset OTP sent for {email}")

        return {
            "success": True,
            "otp_sent": True,
            "otp_code": otp,
            "user": user,
        }

    @staticmethod
    def verify_reset_otp(db: Session, email: str, otp_code: str) -> dict:
        user = UserRepository.get_by_email(db, email)
        if not user:
            return {"success": False, "error_code": "USER_NOT_FOUND"}

        if not verify_otp(user.id, otp_code, purpose="password_reset"):
            logger.warning(f"Invalid password-reset OTP for {email}")
            return {"success": False, "error_code": "INVALID_OTP"}

        # Short-lived, single-purpose token — can't be used as a login/access
        # token (decode_token callers all key off user_id/is_superadmin,
        # never "purpose", so this only means anything to reset_password
        # below) and expires well before a real session token would. jti
        # makes it single-use: a JWT is stateless and would otherwise be
        # replayable for its whole 10-minute lifetime (confirmed live during
        # this feature's own testing — the same token successfully reset the
        # password twice before this was added) — reset_password below
        # claims the jti in Redis atomically on first use.
        jti = str(uuid4())
        reset_token = create_access_token(
            {"user_id": user.id, "purpose": "password_reset", "jti": jti},
            expires_delta=timedelta(minutes=10),
        )
        logger.info(f"Password reset OTP verified for {email}")
        return {"success": True, "reset_token": reset_token}

    @staticmethod
    def reset_password(db: Session, reset_token: str, new_password: str) -> dict:
        payload = decode_token(reset_token)
        jti = payload.get("jti") if payload else None
        if not payload or payload.get("purpose") != "password_reset" or not payload.get("user_id") or not jti:
            return {"success": False, "error_code": "INVALID_RESET_TOKEN"}

        # SETNX-style claim: only the first caller to present this jti gets
        # `True` back; ttl just bounds how long a claimed-but-unused key
        # lingers (the token itself is already expired well before this).
        claimed = redis_conn.set(f"reset_token_used:{jti}", "1", nx=True, ex=900)
        if not claimed:
            return {"success": False, "error_code": "INVALID_RESET_TOKEN"}

        user = UserRepository.get_by_id(db, payload["user_id"])
        if not user:
            return {"success": False, "error_code": "USER_NOT_FOUND"}

        UserRepository.update_password(db, user, hash_password(new_password))
        logger.info(f"Password reset completed for {user.email}")
        return {"success": True}

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
