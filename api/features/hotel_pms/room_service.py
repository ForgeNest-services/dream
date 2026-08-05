from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.hotel_pms.room_repository import RoomRepository, _UNSET
from features.hotel_pms.room_type_repository import RoomTypeRepository
from features.hotel_pms.branch_repository import HotelPMSBranchRepository
from utils.logger import logger


ROOM_STATUSES = {"available", "occupied", "cleaning", "maintenance"}


class RoomService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return HotelPMSBranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def _assert_room_type_in_branch(
        db: Session, tenant_id: str, branch_id: str, room_type_id: str
    ) -> bool:
        rt = RoomTypeRepository.get_by_id(db, tenant_id, room_type_id)
        return rt is not None and rt.branch_id == branch_id

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> dict:
        if not RoomService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        rooms = RoomRepository.list_for_branch(db, tenant_id, branch_id)
        return {"success": True, "rooms": rooms}

    @staticmethod
    def list_paginated(
        db: Session,
        tenant_id: str,
        branch_id: str,
        q: str | None,
        room_type_id: str | None,
        status: str | None,
        offset: int,
        limit: int,
    ) -> dict:
        if not RoomService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        items, total = RoomRepository.list_paginated(
            db,
            tenant_id=tenant_id,
            branch_id=branch_id,
            q=q,
            room_type_id=room_type_id,
            status=status,
            offset=offset,
            limit=limit,
        )
        return {"success": True, "rooms": items, "total": total}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        room_type_id: str,
        room_number: str,
        floor: str | None,
        status: str,
        rate_override: Decimal | None = None,
    ) -> dict:
        if not RoomService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if not RoomService._assert_room_type_in_branch(db, tenant_id, branch_id, room_type_id):
            return {"success": False, "error_code": "ROOM_TYPE_NOT_FOUND"}
        if status not in ROOM_STATUSES:
            return {"success": False, "error_code": "INVALID_STATUS"}
        if rate_override is not None and rate_override <= 0:
            return {"success": False, "error_code": "INVALID_RATE"}

        try:
            room = RoomRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                room_type_id=room_type_id,
                room_number=room_number,
                floor=floor,
                status=status,
                rate_override=rate_override,
            )
            logger.info(
                f"Room created: {room.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "number": room_number},
            )
            return {"success": True, "room": room}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "ROOM_NUMBER_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Room creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        room_id: str,
        room_type_id: str | None = None,
        room_number: str | None = None,
        floor: str | None = None,
        status: str | None = None,
        rate_override=_UNSET,
    ) -> dict:
        room = RoomRepository.get_by_id(db, tenant_id, room_id)
        if not room or room.branch_id != branch_id:
            return {"success": False, "error_code": "ROOM_NOT_FOUND"}

        if room_type_id is not None:
            if not RoomService._assert_room_type_in_branch(db, tenant_id, branch_id, room_type_id):
                return {"success": False, "error_code": "ROOM_TYPE_NOT_FOUND"}

        if status is not None and status not in ROOM_STATUSES:
            return {"success": False, "error_code": "INVALID_STATUS"}

        if rate_override is not _UNSET and rate_override is not None and rate_override <= 0:
            return {"success": False, "error_code": "INVALID_RATE"}

        try:
            updated = RoomRepository.update(
                db,
                room,
                room_type_id=room_type_id,
                room_number=room_number,
                floor=floor,
                status=status,
                rate_override=rate_override,
            )
            return {"success": True, "room": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "ROOM_NUMBER_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Room update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str, room_id: str) -> dict:
        room = RoomRepository.get_by_id(db, tenant_id, room_id)
        if not room or room.branch_id != branch_id:
            return {"success": False, "error_code": "ROOM_NOT_FOUND"}

        RoomRepository.update(db, room, is_active=False)
        logger.info(f"Room deactivated: {room_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
