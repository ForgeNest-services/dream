from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Index
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroKhataSettlement(Base):
    """Ledger entry for a customer paying down their khata (running tab).
    A khata order carries its full amount as a debit; every settlement here
    is a credit against the customer's total. Balance is always:

        SUM(khata order totals)  −  SUM(settlement amounts)

    Partial settlements are natural: the customer can pay Rs 1000 of a Rs 2000
    tab, and the ledger records the Rs 1000 credit — no need to split orders.
    A subsequent Rs 1000 settlement zeroes the balance. `method` is how they
    actually handed over the money (cash or QR)."""

    __tablename__ = "restro_khata_settlements"
    __table_args__ = (
        # Hot path: SUM(amount) WHERE customer_id = X for balance computation.
        Index("ix_restro_khata_settlement_customer", "customer_id", "created_at"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    customer_id = Column(
        String(36),
        ForeignKey("public.restro_customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(String(16), nullable=False)  # cash | qr
    note = Column(String(500), nullable=True)
    # Snapshot of who took the payment (like waiter_name on orders) so the log
    # survives credential renames.
    actor_name = Column(String(150), nullable=False)
    actor_cred_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    # BS mirror of created_at, stamped in NPT — same convention as
    # placed_at_bs on orders.
    created_at_bs = Column(String(10), nullable=False)

    def __repr__(self):
        return f"<RestroKhataSettlement(customer_id={self.customer_id}, amount={self.amount})>"
