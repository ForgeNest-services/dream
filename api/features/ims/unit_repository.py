from sqlalchemy.orm import Session
from shared_models import IMSUnit


class IMSUnitRepository:
    @staticmethod
    def create(
        db: Session, tenant_id: str, name: str, symbol: str, allows_decimals: bool
    ) -> IMSUnit:
        unit = IMSUnit(
            tenant_id=tenant_id,
            name=name,
            symbol=symbol,
            allows_decimals=allows_decimals,
        )
        db.add(unit)
        db.commit()
        db.refresh(unit)
        return unit

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[IMSUnit]:
        # created_at, not name — sorting alphabetically put "Bag" before
        # "Pieces" and silently became the default unit everywhere that
        # falls back to units[0] (new product form, purchase entry). Creation
        # order keeps the seeded "Pieces" first for every tenant, and any
        # custom unit a tenant adds later naturally lands at the end.
        return (
            db.query(IMSUnit)
            .filter(IMSUnit.tenant_id == tenant_id)
            .order_by(IMSUnit.created_at)
            .all()
        )
