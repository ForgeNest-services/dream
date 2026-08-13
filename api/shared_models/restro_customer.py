from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, text
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroCustomer(Base):
    """Branch-scoped customer directory. Used primarily for khata (running
    tab / dues) — a recurring diner or someone the restaurant lets order
    on credit. Referenced from restro_orders.customer_id when an order is
    closed as payment_method='khata'.

    Not the same as delivery_customer_name on RestroOrder — that's a
    one-shot inline snapshot for a walk-in delivery. If a delivery customer
    starts coming often enough to warrant a running tab, promote them to
    a real RestroCustomer row and set orders.customer_id going forward."""

    __tablename__ = "restro_customers"
    __table_args__ = (
        # Phone lookups are the fast path when a waiter is picking during
        # payment ("customer says their number is 98..."). Partial index so
        # deleted rows don't collide.
        Index(
            "uq_restro_customer_active_phone",
            "branch_id",
            "phone",
            unique=True,
            postgresql_where=text("is_active = true AND phone IS NOT NULL AND phone <> ''"),
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(30), nullable=True)
    address = Column(String(500), nullable=True)
    # Free-form note ("prefers window table", "diabetic", "office account"...).
    notes = Column(String(1000), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<RestroCustomer(branch_id={self.branch_id}, name={self.name})>"
