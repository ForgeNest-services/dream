from sqlalchemy.orm import Session
from features.hotel_pms.branch_repository import HotelPMSBranchRepository
from utils.logger import logger


class HotelPMSBranchService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str, tenant) -> list:
        branches = HotelPMSBranchRepository.list_for_tenant(db, tenant_id)
        if not branches:
            branch = HotelPMSBranchRepository.create(
                db,
                tenant_id=tenant_id,
                name=tenant.name,
                address=tenant.business_address,
                phone=tenant.business_phone,
            )
            logger.info(
                f"Auto-provisioned default branch from tenant: {branch.id}",
                extra={"tenant_id": tenant_id},
            )
            return [branch]
        return branches

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        name: str,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
    ) -> dict:
        branch = HotelPMSBranchRepository.create(
            db, tenant_id=tenant_id, name=name, address=address, city=city, phone=phone
        )
        logger.info(f"Hotel PMS branch created: {branch.id}", extra={"tenant_id": tenant_id})
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
        branch = HotelPMSBranchRepository.get_by_id(db, tenant_id, branch_id)
        if not branch:
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        updated = HotelPMSBranchRepository.update(
            db, branch, name=name, address=address, city=city, phone=phone
        )
        logger.info(f"Hotel PMS branch updated: {updated.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "branch": updated}

    @staticmethod
    def list_for_staff(db: Session, tenant_id: str, branch_id: str | None) -> list:
        if branch_id:
            branch = HotelPMSBranchRepository.get_by_id(db, tenant_id, branch_id)
            return [branch] if branch else []
        return HotelPMSBranchRepository.list_for_tenant(db, tenant_id)

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str) -> dict:
        branch = HotelPMSBranchRepository.get_by_id(db, tenant_id, branch_id)
        if not branch:
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        HotelPMSBranchRepository.update(db, branch, is_active=False)
        logger.info(f"Hotel PMS branch deactivated: {branch_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
