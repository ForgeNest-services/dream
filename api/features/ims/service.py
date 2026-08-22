from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from core.security import hash_password, verify_password
from features.ims.repository import IMSCredentialRepository
from features.branches.repository import BranchRepository
from features.ims.auth import issue_staff_token
from features.ims.roles import IMSRole
from utils.logger import logger

BRANCH_SCOPED_ROLES = {
    IMSRole.MANAGER.value,
    IMSRole.STOREKEEPER.value,
}


class IMSCredentialService:
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
            if not BranchRepository.get_by_id(db, tenant_id, branch_id):
                return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        else:
            branch_id = None

        existing = IMSCredentialRepository.get_by_tenant_branch_and_role(
            db, tenant_id, branch_id, role
        )
        if existing:
            return {"success": False, "error_code": "ROLE_ALREADY_HAS_CREDENTIAL"}

        try:
            cred = IMSCredentialRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                role=role,
                username=username,
                password_hash=hash_password(password),
                created_by=created_by,
            )
            logger.info(
                f"IMS credential created: {cred.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "role": role, "username": username},
            )
            return {"success": True, "credential": cred}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "USERNAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"IMS credential creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list:
        return IMSCredentialRepository.list_for_tenant(db, tenant_id)

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        cred_id: str,
        username: str | None = None,
        password: str | None = None,
    ) -> dict:
        cred = IMSCredentialRepository.get_by_id(db, tenant_id, cred_id)
        if not cred:
            return {"success": False, "error_code": "CREDENTIAL_NOT_FOUND"}

        try:
            password_hash = hash_password(password) if password else None
            updated = IMSCredentialRepository.update(
                db, cred, username=username, password_hash=password_hash
            )
            logger.info(
                f"IMS credential updated: {updated.id}",
                extra={"tenant_id": tenant_id, "cred_id": cred_id},
            )
            return {"success": True, "credential": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "USERNAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"IMS credential update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, cred_id: str) -> dict:
        cred = IMSCredentialRepository.get_by_id(db, tenant_id, cred_id)
        if not cred:
            return {"success": False, "error_code": "CREDENTIAL_NOT_FOUND"}

        IMSCredentialRepository.delete(db, cred)
        logger.info(
            "IMS credential deleted",
            extra={"tenant_id": tenant_id, "cred_id": cred_id},
        )
        return {"success": True}


class IMSAuthService:
    @staticmethod
    def login(db: Session, username: str, password: str) -> dict:
        cred = IMSCredentialRepository.get_by_username(db, username)
        if not cred:
            logger.warning(f"IMS login failed: unknown username '{username}'")
            return {"success": False, "error_code": "INVALID_CREDENTIALS"}

        if not verify_password(password, cred.password_hash):
            logger.warning(f"IMS login failed: bad password for '{username}'")
            return {"success": False, "error_code": "INVALID_CREDENTIALS"}

        token, expires_at = issue_staff_token(
            tenant_id=cred.tenant_id,
            role=cred.role,
            cred_id=cred.id,
            branch_id=cred.branch_id,
        )
        logger.info(f"IMS staff login: {username} (role={cred.role})")
        return {
            "success": True,
            "token": token,
            "role": cred.role,
            "tenant_id": cred.tenant_id,
            "branch_id": cred.branch_id,
            "expires_at": expires_at,
        }
