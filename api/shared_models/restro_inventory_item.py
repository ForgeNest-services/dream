from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroInventoryItem(Base):
    """Standalone manual inventory tracking. Orders never mutate stock —
    all changes go through explicit Restock or Adjust actions, each of which
    writes a `restro_stock_movements` row for auditability."""

    __tablename__ = "restro_inventory_items"
    __table_args__ = (
        Index(
            "uq_restro_inventory_active_name",
            "branch_id",
            "name",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False, default="Other")
    # Free-form so the frontend picker can offer kg/liter/piece/packet without
    # locking us out of extra units (grams, ml, dozen) later.
    unit = Column(String(20), nullable=False, default="piece")
    stock = Column(Numeric(12, 2), nullable=False, default=0)
    threshold = Column(Numeric(12, 2), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    movements = relationship(
        "RestroStockMovement",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="RestroStockMovement.created_at.desc()",
    )

    def __repr__(self):
        return f"<RestroInventoryItem(branch_id={self.branch_id}, name={self.name})>"
