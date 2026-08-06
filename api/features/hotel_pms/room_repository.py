from decimal import Decimal
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from shared_models import PMSRoom, PMSRoomType

_UNSET = object()


class RoomRepository:
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
    ) -> PMSRoom:
        room = PMSRoom(
            tenant_id=tenant_id,
            branch_id=branch_id,
            room_type_id=room_type_id,
            room_number=room_number.strip(),
            floor=floor.strip() if floor else None,
            status=status,
            rate_override=rate_override,
        )
        db.add(room)
        db.commit()
        db.refresh(room)
        return room

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, room_id: str) -> PMSRoom | None:
        return (
            db.query(PMSRoom)
            .filter(PMSRoom.id == room_id, PMSRoom.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> list[PMSRoom]:
        return (
            db.query(PMSRoom)
            .filter(
                PMSRoom.tenant_id == tenant_id,
                PMSRoom.branch_id == branch_id,
                PMSRoom.is_active == True,
            )
            .order_by(PMSRoom.room_number)
            .all()
        )

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
    ) -> tuple[list[PMSRoom], int]:
        base = db.query(PMSRoom).filter(
            PMSRoom.tenant_id == tenant_id,
            PMSRoom.branch_id == branch_id,
            PMSRoom.is_active == True,
        )
        if room_type_id:
            base = base.filter(PMSRoom.room_type_id == room_type_id)
        if status:
            base = base.filter(PMSRoom.status == status)
        if q:
            term = f"%{q.strip().lower()}%"
            base = base.outerjoin(
                PMSRoomType, PMSRoom.room_type_id == PMSRoomType.id
            ).filter(
                or_(
                    func.lower(PMSRoom.room_number).like(term),
                    func.lower(PMSRoom.floor).like(term),
                    func.lower(PMSRoomType.name).like(term),
                )
            )
        total = base.with_entities(func.count(PMSRoom.id)).scalar() or 0
        items = (
            base.order_by(PMSRoom.room_number)
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    @staticmethod
    def update(
        db: Session,
        room: PMSRoom,
        room_type_id: str | None = None,
        room_number: str | None = None,
        floor: str | None = None,
        status: str | None = None,
        is_active: bool | None = None,
        rate_override=_UNSET,  # sentinel: pass None explicitly to clear
    ) -> PMSRoom:
        if room_type_id is not None:
            room.room_type_id = room_type_id
        if room_number is not None:
            room.room_number = room_number.strip()
        if floor is not None:
            room.floor = floor.strip() if floor else None
        if status is not None:
            room.status = status
        if is_active is not None:
            room.is_active = is_active
        if rate_override is not _UNSET:
            room.rate_override = rate_override
        db.commit()
        db.refresh(room)
        return room
