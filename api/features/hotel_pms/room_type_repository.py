from decimal import Decimal
from sqlalchemy.orm import Session
from shared_models import PMSRoomType


class RoomTypeRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        base_rate: Decimal,
        capacity: int,
        count: int,
    ) -> PMSRoomType:
        room_type = PMSRoomType(
            tenant_id=tenant_id,
            branch_id=branch_id,
            name=name.strip(),
            base_rate=base_rate,
            capacity=capacity,
            count=count,
        )
        db.add(room_type)
        db.commit()
        db.refresh(room_type)
        return room_type

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, room_type_id: str) -> PMSRoomType | None:
        return (
            db.query(PMSRoomType)
            .filter(
                PMSRoomType.id == room_type_id,
                PMSRoomType.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> list[PMSRoomType]:
        return (
            db.query(PMSRoomType)
            .filter(
                PMSRoomType.tenant_id == tenant_id,
                PMSRoomType.branch_id == branch_id,
                PMSRoomType.is_active == True,
            )
            .order_by(PMSRoomType.name)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        room_type: PMSRoomType,
        name: str | None = None,
        base_rate: Decimal | None = None,
        capacity: int | None = None,
        count: int | None = None,
        is_active: bool | None = None,
    ) -> PMSRoomType:
        if name is not None:
            room_type.name = name.strip()
        if base_rate is not None:
            room_type.base_rate = base_rate
        if capacity is not None:
            room_type.capacity = capacity
        if count is not None:
            room_type.count = count
        if is_active is not None:
            room_type.is_active = is_active
        db.commit()
        db.refresh(room_type)
        return room_type
