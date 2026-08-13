from sqlalchemy import (
    Column,
    String,
    Numeric,
    DateTime,
    ForeignKey,
    Index,
    text,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroOrder(Base):
    """A single bill — either dine-in (tied to a table) or delivery (tied to a
    customer via customer_id). `status='draft'` is an open bill; `paid` is
    closed; `cancelled` was abandoned. Merged tables share one draft order via
    the merge group lookup (see order_repository.get_draft_for_table).

    Payment methods:
      cash / qr  → immediate settlement; paid_at and settled_at both = now()
      khata      → running-tab close; paid_at = now(), settled_at = NULL until
                   the customer pays down their balance via the settle-khata
                   endpoint. Requires customer_id.

    Delivery orders always require customer_id — inline customer name/phone/
    address columns were dropped when khata unified the customer story."""

    __tablename__ = "restro_orders"
    __table_args__ = (
        # At most one open bill per dine-in table at a time.
        Index(
            "uq_restro_order_open_per_table",
            "table_id",
            unique=True,
            postgresql_where=text("status = 'draft' AND type = 'dine-in'"),
        ),
        Index("ix_restro_order_branch_status", "branch_id", "status"),
        Index("ix_restro_order_branch_kitchen", "branch_id", "kitchen_status"),
        # Fiscal-year / monthly BS reporting hits this index.
        Index("ix_restro_order_branch_placed_bs", "branch_id", "placed_at_bs"),
        # Hot path for a customer's outstanding khata balance.
        Index(
            "ix_restro_order_customer_khata",
            "customer_id",
            "settled_at",
            postgresql_where=text("payment_method = 'khata'"),
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    # Nullable for delivery orders. For dine-in it points to the "primary"
    # table of a merge group (or the sole table if not merged).
    table_id = Column(String(36), ForeignKey("public.restro_tables.id"), nullable=True, index=True)
    # Required for delivery orders (populated on create), and for orders
    # closed as payment_method='khata' (populated on mark-paid). Optional
    # for cash/qr dine-in.
    customer_id = Column(String(36), ForeignKey("public.restro_customers.id"), nullable=True, index=True)

    type = Column(String(20), nullable=False)  # "dine-in" | "delivery"
    status = Column(String(20), nullable=False, default="draft")  # draft|paid|cancelled
    kitchen_status = Column(String(20), nullable=False, default="new")  # new|cooking|ready|served

    placed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    paid_at = Column(DateTime, nullable=True)
    settled_at = Column(DateTime, nullable=True)

    # Bikram Sambat mirrors, snapshotted at write time. Kept as real columns
    # (not views) so reports hit an index and records survive calendar-table
    # corrections. See api/utils/bikram_sambat.py.
    placed_at_bs = Column(String(10), nullable=False)
    paid_at_bs = Column(String(10), nullable=True)
    settled_at_bs = Column(String(10), nullable=True)

    discount_type = Column(String(10), nullable=False, default="percent")  # percent|flat
    discount_value = Column(Numeric(10, 2), nullable=False, default=0)

    # cash|qr|khata — set on mark-paid.
    payment_method = Column(String(16), nullable=True)

    # Snapshot of the waiter who opened the order. `waiter_cred_id` is FK-lite
    # (no cascade) so credential deletion doesn't wipe history.
    waiter_name = Column(String(100), nullable=False)
    waiter_cred_id = Column(String(36), nullable=True)

    # Delivery workflow status (only meaningful for type='delivery').
    delivery_status = Column(String(20), nullable=True)  # pending|out|delivered

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    lines = relationship(
        "RestroOrderLine",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="RestroOrderLine.created_at",
    )
    customer = relationship("RestroCustomer", lazy="joined")

    def __repr__(self):
        return f"<RestroOrder(id={self.id}, type={self.type}, status={self.status})>"
