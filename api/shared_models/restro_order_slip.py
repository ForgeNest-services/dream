from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroOrderSlip(Base):
    """One row per "send to kitchen" event — the Order Slip (Electronic
    Billing Procedure 2082, clause 6.2घ). Restaurants/hotels using Order
    Slips must keep the slip's own sequential number and log, and reference
    it inside the final e-bill. `slip_number` is a separate gapless
    sequence from RestroOrder.bill_number (see RestroOrderSlipSerial) —
    a bill can reference multiple slips if items were sent to the kitchen
    across more than one round.
    """

    __tablename__ = "restro_order_slips"
    __table_args__ = (
        Index("uq_restro_order_slip_number", "branch_id", "fiscal_year", "slip_number", unique=True),
        Index("ix_restro_order_slip_order", "order_id"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    order_id = Column(String(36), ForeignKey("public.restro_orders.id"), nullable=False, index=True)
    slip_number = Column(Integer, nullable=False)
    fiscal_year = Column(String(10), nullable=False)
    # How many lines this particular kitchen round sent — the "Log" the
    # clause asks for; the lines themselves stay on RestroOrderLine (which
    # already carries sent/created_at), this is just the slip-level index.
    line_count = Column(Integer, nullable=False, default=0)
    created_by = Column(String(36), nullable=True)  # waiter_cred_id snapshot

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at_bs = Column(String(10), nullable=False)

    order = relationship("RestroOrder", backref="slips")

    def __repr__(self):
        return f"<RestroOrderSlip(order={self.order_id}, slip_number={self.slip_number})>"
