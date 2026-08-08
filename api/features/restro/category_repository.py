from sqlalchemy.orm import Session
from shared_models import RestroCategory


class CategoryRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        display_order: int = 0,
    ) -> RestroCategory:
        category = RestroCategory(
            tenant_id=tenant_id,
            branch_id=branch_id,
            name=name.strip(),
            display_order=display_order,
        )
        db.add(category)
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, category_id: str) -> RestroCategory | None:
        return (
            db.query(RestroCategory)
            .filter(
                RestroCategory.id == category_id,
                RestroCategory.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> list[RestroCategory]:
        return (
            db.query(RestroCategory)
            .filter(
                RestroCategory.tenant_id == tenant_id,
                RestroCategory.branch_id == branch_id,
                RestroCategory.is_active == True,
            )
            .order_by(RestroCategory.display_order, RestroCategory.name)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        category: RestroCategory,
        name: str | None = None,
        display_order: int | None = None,
        is_active: bool | None = None,
    ) -> RestroCategory:
        if name is not None:
            category.name = name.strip()
        if display_order is not None:
            category.display_order = display_order
        if is_active is not None:
            category.is_active = is_active
        db.commit()
        db.refresh(category)
        return category
