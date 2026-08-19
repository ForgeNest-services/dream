from sqlalchemy.orm import Session
from shared_models import IMSCategory


class IMSCategoryRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        name: str,
        parent_id: str | None,
    ) -> IMSCategory:
        category = IMSCategory(
            tenant_id=tenant_id,
            parent_id=parent_id,
            name=name.strip(),
        )
        db.add(category)
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, category_id: str) -> IMSCategory | None:
        return (
            db.query(IMSCategory)
            .filter(IMSCategory.id == category_id, IMSCategory.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[IMSCategory]:
        return (
            db.query(IMSCategory)
            .filter(IMSCategory.tenant_id == tenant_id)
            .order_by(IMSCategory.name)
            .all()
        )

    @staticmethod
    def has_children(db: Session, tenant_id: str, category_id: str) -> bool:
        return (
            db.query(IMSCategory)
            .filter(IMSCategory.tenant_id == tenant_id, IMSCategory.parent_id == category_id)
            .first()
            is not None
        )

    @staticmethod
    def update(db: Session, category: IMSCategory, name: str | None = None) -> IMSCategory:
        if name is not None:
            category.name = name.strip()
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def delete(db: Session, category: IMSCategory) -> None:
        db.delete(category)
        db.commit()
