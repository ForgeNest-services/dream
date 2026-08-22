from sqlalchemy.orm import Session
from shared_models import IMSBrand


class IMSBrandRepository:
    @staticmethod
    def create(db: Session, tenant_id: str, name: str) -> IMSBrand:
        brand = IMSBrand(tenant_id=tenant_id, name=name.strip())
        db.add(brand)
        db.commit()
        db.refresh(brand)
        return brand

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, brand_id: str) -> IMSBrand | None:
        return (
            db.query(IMSBrand)
            .filter(IMSBrand.id == brand_id, IMSBrand.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[IMSBrand]:
        return (
            db.query(IMSBrand)
            .filter(IMSBrand.tenant_id == tenant_id)
            .order_by(IMSBrand.name)
            .all()
        )

    @staticmethod
    def delete(db: Session, brand: IMSBrand) -> None:
        db.delete(brand)
        db.commit()
