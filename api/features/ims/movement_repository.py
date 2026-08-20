from datetime import datetime
from sqlalchemy.orm import Session
from shared_models import IMSStockMovement, IMSProduct, IMSVariant


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
        type_: str | None,
        q: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        offset: int,
        limit: int,
    ) -> tuple[list[IMSStockMovement], int]:
        from sqlalchemy import func, or_

        query = db.query(IMSStockMovement).filter(IMSStockMovement.tenant_id == tenant_id)
        if branch_id:
            query = query.filter(IMSStockMovement.branch_id == branch_id)
        if variant_id:
            query = query.filter(IMSStockMovement.variant_id == variant_id)
        if type_:
            query = query.filter(IMSStockMovement.type == type_)
        if date_from:
            query = query.filter(IMSStockMovement.date >= date_from)
        if date_to:
            query = query.filter(IMSStockMovement.date <= date_to)
        if q:
            term = f"%{q.strip().lower()}%"
            query = (
                query.outerjoin(IMSProduct, IMSProduct.id == IMSStockMovement.product_id)
                .outerjoin(IMSVariant, IMSVariant.id == IMSStockMovement.variant_id)
                .filter(
                    or_(
                        func.lower(IMSProduct.name).like(term),
                        func.lower(IMSVariant.name).like(term),
                        func.lower(IMSStockMovement.reference).like(term),
                        func.lower(IMSStockMovement.reason).like(term),
                    )
                )
            )
        total = query.distinct().count()
        items = (
            query.distinct()
            .order_by(IMSStockMovement.date.desc(), IMSStockMovement.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total
