from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroStockMovement(Base):
    """Audit row for every stock change. `delta` is signed — positive for a
    restock, positive-or-negative for an adjust. `actor_name` is snapshotted
    (like `waiter_name` on orders) so the log survives credential renames."""

    __tablename__ = "restro_stock_movements"
    __table_args__ = (
        Index("ix_restro_stock_movement_item_created", "item_id", "created_at"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    item_id = Column(
        String(36),
        ForeignKey("public.restro_inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(String(20), nullable=False)  # restock | adjust
    delta = Column(Numeric(12, 2), nullable=False)
    reason = Column(String(200), nullable=False)
    note = Column(String(500), nullable=True)
    # Only meaningful for restock rows; NULL on adjustments.
    cost = Column(Numeric(12, 2), nullable=True)
    actor_name = Column(String(150), nullable=False)
    actor_cred_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    item = relationship("RestroInventoryItem", back_populates="movements")

    def __repr__(self):
        return f"<RestroStockMovement(item_id={self.item_id}, delta={self.delta})>"
