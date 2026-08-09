from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.zone_repository import ZoneRepository
from features.restro.table_repository import TableRepository
from features.branches.repository import BranchRepository
from utils.logger import logger

DEFAULT_ZONE_NAME = "Main Floor"


class ZoneService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> dict:
        if not ZoneService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        zones = ZoneRepository.list_for_branch(db, tenant_id, branch_id)
        if not zones:
            ZoneRepository.create(db, tenant_id, branch_id, DEFAULT_ZONE_NAME, display_order=0)
            logger.info(
                f"Auto-provisioned default zone '{DEFAULT_ZONE_NAME}' for branch {branch_id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id},
            )
            zones = ZoneRepository.list_for_branch(db, tenant_id, branch_id)
        return {"success": True, "zones": zones}

    @staticmethod
    def create(
        db: Session, tenant_id: str, branch_id: str, name: str, display_order: int = 0
    ) -> dict:
        if not ZoneService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        try:
            zone = ZoneRepository.create(db, tenant_id, branch_id, name, display_order)
            logger.info(
                f"Zone created: {zone.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "name": name},
            )
            return {"success": True, "zone": zone}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Zone creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        zone_id: str,
        name: str | None = None,
        display_order: int | None = None,
    ) -> dict:
        zone = ZoneRepository.get_by_id(db, tenant_id, zone_id)
        if not zone or not zone.is_active:
            return {"success": False, "error_code": "ZONE_NOT_FOUND"}
        try:
            updated = ZoneRepository.update(db, zone, name=name, display_order=display_order)
            return {"success": True, "zone": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Zone update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, zone_id: str) -> dict:
        zone = ZoneRepository.get_by_id(db, tenant_id, zone_id)
        if not zone or not zone.is_active:
            return {"success": False, "error_code": "ZONE_NOT_FOUND"}
        # Refuse to soft-delete a zone that still has active tables — owner must
        # move or remove those tables first, or we'd orphan them in the UI.
        if TableRepository.has_active_tables_in_zone(db, tenant_id, zone_id):
            return {"success": False, "error_code": "ZONE_HAS_TABLES"}
        ZoneRepository.update(db, zone, is_active=False)
        logger.info(f"Zone deactivated: {zone_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
