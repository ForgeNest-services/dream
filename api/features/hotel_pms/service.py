from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from core.security import hash_password, verify_password
from features.hotel_pms.repository import HotelPMSCredentialRepository
from features.hotel_pms.branch_repository import HotelPMSBranchRepository
from features.hotel_pms.auth import issue_staff_token
from features.hotel_pms.roles import HotelPMSRole
from utils.logger import logger

BRANCH_SCOPED_ROLES = {HotelPMSRole.MANAGER.value, HotelPMSRole.FRONT_DESK.value}


class HotelPMSCredentialService:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        created_by: str,
        role: str,
        username: str,
        password: str,
        branch_id: str | None,
    ) -> dict:
        if role in BRANCH_SCOPED_ROLES:
            if not branch_id:
                return {"success": False, "error_code": "BRANCH_REQUIRED"}
            if not HotelPMSBranchRepository.get_by_id(db, tenant_id, branch_id):
                return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        else:
            branch_id = None

        existing = HotelPMSCredentialRepository.get_by_tenant_branch_and_role(
            db, tenant_id, branch_id, role
        )
        if existing:
            return {"success": False, "error_code": "ROLE_ALREADY_HAS_CREDENTIAL"}

        try:
            cred = HotelPMSCredentialRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                role=role,
                username=username,
                password_hash=hash_password(password),
                created_by=created_by,
            )
            logger.info(
                f"Hotel PMS credential created: {cred.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "role": role, "username": username},
            )
            return {"success": True, "credential": cred}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "USERNAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Credential creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list:
        return HotelPMSCredentialRepository.list_for_tenant(db, tenant_id)

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        cred_id: str,
        username: str | None = None,
        password: str | None = None,
    ) -> dict:
        cred = HotelPMSCredentialRepository.get_by_id(db, tenant_id, cred_id)
        if not cred:
            return {"success": False, "error_code": "CREDENTIAL_NOT_FOUND"}

        try:
            password_hash = hash_password(password) if password else None
            updated = HotelPMSCredentialRepository.update(
                db, cred, username=username, password_hash=password_hash
            )
            logger.info(
                f"Hotel PMS credential updated: {updated.id}",
                extra={"tenant_id": tenant_id, "cred_id": cred_id},
            )
            return {"success": True, "credential": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "USERNAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Credential update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, cred_id: str) -> dict:
        cred = HotelPMSCredentialRepository.get_by_id(db, tenant_id, cred_id)
        if not cred:
            return {"success": False, "error_code": "CREDENTIAL_NOT_FOUND"}

        HotelPMSCredentialRepository.delete(db, cred)
        logger.info(
            f"Hotel PMS credential deleted",
            extra={"tenant_id": tenant_id, "cred_id": cred_id},
        )
        return {"success": True}


class HotelPMSAuthService:
    @staticmethod
    def login(db: Session, username: str, password: str) -> dict:
        cred = HotelPMSCredentialRepository.get_by_username(db, username)
        if not cred:
            logger.warning(f"Hotel PMS login failed: unknown username '{username}'")
            return {"success": False, "error_code": "INVALID_CREDENTIALS"}

        if not verify_password(password, cred.password_hash):
            logger.warning(
                f"Hotel PMS login failed: bad password for '{username}'"
            )
            return {"success": False, "error_code": "INVALID_CREDENTIALS"}

        token, expires_at = issue_staff_token(
            tenant_id=cred.tenant_id,
            role=cred.role,
            cred_id=cred.id,
            branch_id=cred.branch_id,
        )
        logger.info(f"Hotel PMS staff login: {username} (role={cred.role})")
        return {
            "success": True,
            "token": token,
            "role": cred.role,
            "tenant_id": cred.tenant_id,
            "branch_id": cred.branch_id,
            "expires_at": expires_at,
        }
