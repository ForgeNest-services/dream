from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from core.security import hash_password, verify_password
from features.restro.repository import RestroCredentialRepository
from features.branches.repository import BranchRepository
from features.restro.auth import issue_staff_token
from features.restro.roles import RestroRole
from features.hotel_pms.audit_repository import AuditRepository
from utils.logger import logger

BRANCH_SCOPED_ROLES = {RestroRole.MANAGER.value, RestroRole.WAITER.value, RestroRole.CHEF.value}


class RestroCredentialService:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        created_by: str,
        role: str,
        name: str,
        username: str,
        password: str,
        branch_id: str | None,
        email: str | None = None,
        phone: str | None = None,
    ) -> dict:
        if role in BRANCH_SCOPED_ROLES:
            if not branch_id:
                return {"success": False, "error_code": "BRANCH_REQUIRED"}
            if not BranchRepository.get_by_id(db, tenant_id, branch_id):
                return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        else:
            branch_id = None

        try:
            cred = RestroCredentialRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                role=role,
                name=name,
                email=email,
                phone=phone,
                username=username,
                password_hash=hash_password(password),
                created_by=created_by,
            )
            logger.info(
                f"Restro credential created: {cred.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "role": role, "username": username},
            )
            # First credential for this app starts its independent 30-day
            # trial (see SubscriptionService.start_trial_if_needed) — a
            # no-op if the tenant already has a subscription row for this
            # app, so safe to call on every credential, not just the first.
            try:
                from features.subscriptions.service import SubscriptionService
                SubscriptionService.start_trial_if_needed(db, tenant_id, "srota_rms")
            except Exception as e:
                logger.error(f"Failed to start RMS trial for tenant {tenant_id}: {e}")
            return {"success": True, "credential": cred}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "USERNAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Restro credential creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list:
        return RestroCredentialRepository.list_for_tenant(db, tenant_id)

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        cred_id: str,
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ) -> dict:
        cred = RestroCredentialRepository.get_by_id(db, tenant_id, cred_id)
        if not cred:
            return {"success": False, "error_code": "CREDENTIAL_NOT_FOUND"}

        try:
            password_hash = hash_password(password) if password else None
            updated = RestroCredentialRepository.update(
                db, cred, name=name, email=email, phone=phone,
                username=username, password_hash=password_hash
            )
            logger.info(
                f"Restro credential updated: {updated.id}",
                extra={"tenant_id": tenant_id, "cred_id": cred_id},
            )
            return {"success": True, "credential": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "USERNAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Restro credential update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, cred_id: str) -> dict:
        cred = RestroCredentialRepository.get_by_id(db, tenant_id, cred_id)
        if not cred:
            return {"success": False, "error_code": "CREDENTIAL_NOT_FOUND"}

        RestroCredentialRepository.delete(db, cred)
        logger.info(
            "Restro credential deleted",
            extra={"tenant_id": tenant_id, "cred_id": cred_id},
        )
        return {"success": True}


class RestroAuthService:
    @staticmethod
    def login(db: Session, username: str, password: str, terminal_ip: str | None = None) -> dict:
        cred = RestroCredentialRepository.get_by_username(db, username)
        if not cred:
            logger.warning(f"Restro login failed: unknown username '{username}'")
            return {"success": False, "error_code": "INVALID_CREDENTIALS"}

        if not verify_password(password, cred.password_hash):
            # IRD: Electronic Billing Procedure 2082, clause 6.3ख — all user
            # activity, not just successful logins, belongs in the activity
            # log. tenant_id is known even on a bad password (username
            # resolved), so this is attributable, unlike an unknown username.
            AuditRepository.write(
                db,
                tenant_id=cred.tenant_id,
                app_code="restro",
                entity_type="credential",
                entity_id=cred.id,
                action="login_failed",
                performed_by=cred.id,
                performer_type="staff",
                after_state={"username": username},
                terminal_ip=terminal_ip,
            )
            db.commit()
            logger.warning(f"Restro login failed: bad password for '{username}'")
            return {"success": False, "error_code": "INVALID_CREDENTIALS"}

        from features.subscriptions.service import SubscriptionService
        if not SubscriptionService.is_accessible(db, cred.tenant_id, "srota_rms"):
            AuditRepository.write(
                db,
                tenant_id=cred.tenant_id,
                app_code="restro",
                entity_type="credential",
                entity_id=cred.id,
                action="login_blocked",
                performed_by=cred.id,
                performer_type="staff",
                after_state={"username": username, "reason": "subscription_expired"},
                terminal_ip=terminal_ip,
            )
            db.commit()
            logger.warning(f"Restro login blocked (subscription expired): {username}")
            return {"success": False, "error_code": "SUBSCRIPTION_EXPIRED"}

        token, expires_at = issue_staff_token(
            tenant_id=cred.tenant_id,
            role=cred.role,
            cred_id=cred.id,
            branch_id=cred.branch_id,
            name=cred.name,
        )
        AuditRepository.write(
            db,
            tenant_id=cred.tenant_id,
            app_code="restro",
            entity_type="credential",
            entity_id=cred.id,
            action="login",
            performed_by=cred.id,
            performer_type="staff",
            after_state={"username": username, "role": cred.role, "branch_id": cred.branch_id},
            terminal_ip=terminal_ip,
        )
        db.commit()
        logger.info(f"Restro staff login: {username} (role={cred.role})")
        return {
            "success": True,
            "token": token,
            "role": cred.role,
            "name": cred.name,
            "tenant_id": cred.tenant_id,
            "branch_id": cred.branch_id,
            "expires_at": expires_at,
        }

    @staticmethod
    def logout(db: Session, tenant_id: str, cred_id: str, terminal_ip: str | None = None) -> None:
        """No server-side session to invalidate (stateless 8h JWTs, no
        refresh — see CLAUDE.md §2.6) — this exists purely so the activity
        log has a real logout event, not just an inferred token-expiry gap."""
        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="restro",
            entity_type="credential",
            entity_id=cred_id,
            action="logout",
            performed_by=cred_id,
            performer_type="staff",
            terminal_ip=terminal_ip,
        )
        db.commit()
