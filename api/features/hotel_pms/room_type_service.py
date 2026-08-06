from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.hotel_pms.room_type_repository import RoomTypeRepository
from features.hotel_pms.branch_repository import HotelPMSBranchRepository
from utils.logger import logger


class RoomTypeService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return HotelPMSBranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> dict:
        if not RoomTypeService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        room_types = RoomTypeRepository.list_for_branch(db, tenant_id, branch_id)
        return {"success": True, "room_types": room_types}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        base_rate: Decimal,
        capacity: int,
        count: int,
    ) -> dict:
        if not RoomTypeService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        try:
            room_type = RoomTypeRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                name=name,
                base_rate=base_rate,
                capacity=capacity,
                count=count,
            )
            logger.info(
                f"Room type created: {room_type.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "name": name},
            )
            return {"success": True, "room_type": room_type}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Room type creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        room_type_id: str,
        name: str | None = None,
        base_rate: Decimal | None = None,
        capacity: int | None = None,
        count: int | None = None,
    ) -> dict:
        room_type = RoomTypeRepository.get_by_id(db, tenant_id, room_type_id)
        if not room_type:
            return {"success": False, "error_code": "ROOM_TYPE_NOT_FOUND"}

        try:
            updated = RoomTypeRepository.update(
                db,
                room_type,
                name=name,
                base_rate=base_rate,
                capacity=capacity,
                count=count,
            )
            return {"success": True, "room_type": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Room type update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, room_type_id: str) -> dict:
        room_type = RoomTypeRepository.get_by_id(db, tenant_id, room_type_id)
        if not room_type:
            return {"success": False, "error_code": "ROOM_TYPE_NOT_FOUND"}

        RoomTypeRepository.update(db, room_type, is_active=False)
        logger.info(f"Room type deactivated: {room_type_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
