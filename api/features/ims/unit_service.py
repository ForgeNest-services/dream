from sqlalchemy.orm import Session
from features.ims.unit_repository import IMSUnitRepository
from utils.logger import logger

# Matches ims/src/data/mock.ts's UNITS seed exactly, so a fresh tenant sees
# the same starting unit list the mock/demo data always showed.
DEFAULT_UNITS = [
    ("Pieces", "pcs", False),
    ("Box", "box", False),
    ("Kilogram", "kg", True),
    ("Bag", "bag", False),
    ("Litre", "ltr", True),
    ("Metre", "m", True),
    ("Roll", "roll", False),
    ("Set", "set", False),
]


class IMSUnitService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list:
        units = IMSUnitRepository.list_for_tenant(db, tenant_id)
        if not units:
            for name, symbol, allows_decimals in DEFAULT_UNITS:
                IMSUnitRepository.create(db, tenant_id, name, symbol, allows_decimals)
            logger.info(f"IMS default units seeded for tenant {tenant_id}")
            units = IMSUnitRepository.list_for_tenant(db, tenant_id)
        return units
