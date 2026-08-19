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
        return (
            db.query(IMSUnit)
            .filter(IMSUnit.tenant_id == tenant_id)
            .order_by(IMSUnit.name)
            .all()
        )
