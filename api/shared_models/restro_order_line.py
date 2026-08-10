from sqlalchemy import Column, String, Integer, Boolean, Numeric, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroOrderLine(Base):
    """One item on an order. `name`, `variant_name`, and `price` are
    snapshotted at add-time so historical bills stay stable even if the
    underlying menu item is later renamed, repriced, or deleted.
    """

    __tablename__ = "restro_order_lines"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(
        String(36),
        ForeignKey("public.restro_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Soft reference — no cascade — so deleting/renaming a menu item does not
    # touch historical order lines.
    menu_item_id = Column(String(36), nullable=True)

    name = Column(String(200), nullable=False)
    variant_name = Column(String(100), nullable=True)
    price = Column(Numeric(10, 2), nullable=False)  # unit price snapshot
    qty = Column(Integer, nullable=False, default=1)
    note = Column(Text, nullable=True)

    sent = Column(Boolean, nullable=False, default=False)  # sent to kitchen?
    is_voided = Column(Boolean, nullable=False, default=False)
    voided_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    order = relationship("RestroOrder", back_populates="lines")

    def __repr__(self):
        return f"<RestroOrderLine(order_id={self.order_id}, name={self.name}, qty={self.qty})>"
