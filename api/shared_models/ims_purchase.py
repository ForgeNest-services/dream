from sqlalchemy import Column, String, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSPurchase(Base):
    """A recorded supplier bill — receives stock (via IMSPurchaseLine +
    stock movements posted alongside, see IMSPurchaseService.create) and
    optionally posts a bill/payment pair to the party ledger. Append-only,
    like invoices/audit_log elsewhere in the project — a purchase is never
    edited or deleted once saved."""

    __tablename__ = "ims_purchases"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    number = Column(String(50), nullable=False)
    date = Column(DateTime, nullable=False)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    # Not ON DELETE CASCADE/SET NULL on purpose — a party with purchase
    # history can never be hard-deleted (see IMSPartyService.delete's
    # HAS_PURCHASE_HISTORY check), so this FK is never actually put in a
    # position to need cascade behavior.
    party_id = Column(String(36), ForeignKey("public.ims_parties.id"), nullable=True, index=True)
    bill_no = Column(String(100), nullable=True)
    items_total = Column(Numeric(12, 2), nullable=False, default=0)
    bill_amount = Column(Numeric(12, 2), nullable=False, default=0)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)
    payment_method = Column(String(20), nullable=False)
    post_to_ledger = Column(Boolean, nullable=False, default=False)
    note = Column(String(1000), nullable=True)
    user_id = Column(String(36), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    lines = relationship(
        "IMSPurchaseLine", back_populates="purchase", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<IMSPurchase(tenant_id={self.tenant_id}, number={self.number})>"
