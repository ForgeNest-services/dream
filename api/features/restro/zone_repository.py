from sqlalchemy.orm import Session
from shared_models import RestroZone


class ZoneRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        display_order: int = 0,
    ) -> RestroZone:
        zone = RestroZone(
            tenant_id=tenant_id,
            branch_id=branch_id,
            name=name.strip(),
            display_order=display_order,
        )
        db.add(zone)
        db.commit()
        db.refresh(zone)
        return zone

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, zone_id: str) -> RestroZone | None:
        return (
            db.query(RestroZone)
            .filter(RestroZone.id == zone_id, RestroZone.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> list[RestroZone]:
        return (
            db.query(RestroZone)
            .filter(
                RestroZone.tenant_id == tenant_id,
                RestroZone.branch_id == branch_id,
                RestroZone.is_active == True,
            )
            .order_by(RestroZone.display_order, RestroZone.name)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        zone: RestroZone,
        name: str | None = None,
        display_order: int | None = None,
        is_active: bool | None = None,
    ) -> RestroZone:
        if name is not None:
            zone.name = name.strip()
        if display_order is not None:
            zone.display_order = display_order
        if is_active is not None:
            zone.is_active = is_active
        db.commit()
        db.refresh(zone)
        return zone
