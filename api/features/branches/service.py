from sqlalchemy.orm import Session
from features.branches.repository import BranchRepository
from utils.logger import logger


class BranchService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str, tenant) -> list:
        """List active branches; auto-provisions a default one from tenant info
        on first call so a fresh tenant always has at least one branch."""
        branches = BranchRepository.list_for_tenant(db, tenant_id)
        if not branches:
            branch = BranchRepository.create(
                db,
                tenant_id=tenant_id,
                name=tenant.name,
                address=tenant.business_address,
                phone=tenant.business_phone,
            )
            logger.info(
                f"Auto-provisioned default branch: {branch.id}",
                extra={"tenant_id": tenant_id},
            )
            return [branch]
        return branches

    @staticmethod
    def list_for_staff(db: Session, tenant_id: str, branch_id: str | None) -> list:
        if branch_id:
            branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
            return [branch] if branch else []
        return BranchRepository.list_for_tenant(db, tenant_id)

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        name: str,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
    ) -> dict:
        branch = BranchRepository.create(
            db, tenant_id=tenant_id, name=name, address=address, city=city, phone=phone
        )
        logger.info(f"Branch created: {branch.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "branch": branch}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str | None = None,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
    ) -> dict:
        branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
        if not branch:
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        updated = BranchRepository.update(
            db, branch, name=name, address=address, city=city, phone=phone
        )
        logger.info(f"Branch updated: {updated.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "branch": updated}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str) -> dict:
        branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
        if not branch:
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        BranchRepository.update(db, branch, is_active=False)
        logger.info(f"Branch deactivated: {branch_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
