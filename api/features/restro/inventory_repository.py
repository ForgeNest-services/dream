from decimal import Decimal
from sqlalchemy.orm import Session
from shared_models import RestroInventoryItem, RestroStockMovement


class InventoryRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        category: str,
        unit: str,
        threshold: Decimal,
    ) -> RestroInventoryItem:
        item = RestroInventoryItem(
            tenant_id=tenant_id,
            branch_id=branch_id,
            name=name.strip(),
            category=category.strip() or "Other",
            unit=unit,
            threshold=threshold,
            stock=Decimal("0"),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, item_id: str) -> RestroInventoryItem | None:
        return (
            db.query(RestroInventoryItem)
            .filter(
                RestroInventoryItem.id == item_id,
                RestroInventoryItem.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> list[RestroInventoryItem]:
        return (
            db.query(RestroInventoryItem)
            .filter(
                RestroInventoryItem.tenant_id == tenant_id,
                RestroInventoryItem.branch_id == branch_id,
                RestroInventoryItem.is_active == True,
            )
            .order_by(RestroInventoryItem.category, RestroInventoryItem.name)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        item: RestroInventoryItem,
        name: str | None = None,
        category: str | None = None,
        unit: str | None = None,
        threshold: Decimal | None = None,
        is_active: bool | None = None,
    ) -> RestroInventoryItem:
        if name is not None:
            item.name = name.strip()
        if category is not None:
            item.category = category.strip() or "Other"
        if unit is not None:
            item.unit = unit
        if threshold is not None:
            item.threshold = threshold
        if is_active is not None:
            item.is_active = is_active
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def apply_delta(
        db: Session,
        item: RestroInventoryItem,
        delta: Decimal,
        *,
        movement_type: str,
        reason: str,
        note: str | None,
        cost: Decimal | None,
        actor_name: str,
        actor_cred_id: str | None,
        clamp_zero: bool,
    ) -> tuple[RestroInventoryItem, RestroStockMovement]:
        """Applies a stock change AND records the movement in a single transaction
        so the two never diverge. `clamp_zero=True` prevents adjustments from
        pushing stock below zero (mirror of the frontend `Math.max(0, ...)`)."""
        new_stock = Decimal(item.stock) + delta
        if clamp_zero and new_stock < 0:
            new_stock = Decimal("0")
        item.stock = new_stock

        movement = RestroStockMovement(
            tenant_id=item.tenant_id,
            branch_id=item.branch_id,
            item_id=item.id,
            type=movement_type,
            delta=delta,
            reason=reason,
            note=note,
            cost=cost,
            actor_name=actor_name,
            actor_cred_id=actor_cred_id,
        )
        db.add(movement)
        db.commit()
        db.refresh(item)
        db.refresh(movement)
        return item, movement

    @staticmethod
    def list_movements(
        db: Session,
        tenant_id: str,
        item_id: str,
        limit: int = 200,
    ) -> list[RestroStockMovement]:
        return (
            db.query(RestroStockMovement)
            .filter(
                RestroStockMovement.tenant_id == tenant_id,
                RestroStockMovement.item_id == item_id,
            )
            .order_by(RestroStockMovement.created_at.desc())
            .limit(limit)
            .all()
        )
