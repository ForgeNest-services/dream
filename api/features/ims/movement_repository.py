from sqlalchemy.orm import Session
from shared_models import IMSStockMovement


class IMSMovementRepository:
    @staticmethod
    def create(db: Session, **fields) -> IMSStockMovement:
        movement = IMSStockMovement(**fields)
        db.add(movement)
        db.commit()
        db.refresh(movement)
        return movement

    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        variant_id: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[IMSStockMovement], int]:
        query = db.query(IMSStockMovement).filter(IMSStockMovement.tenant_id == tenant_id)
        if branch_id:
            query = query.filter(IMSStockMovement.branch_id == branch_id)
        if variant_id:
            query = query.filter(IMSStockMovement.variant_id == variant_id)
        total = query.count()
        items = (
            query.order_by(IMSStockMovement.date.desc(), IMSStockMovement.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total
