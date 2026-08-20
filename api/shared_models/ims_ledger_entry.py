from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSLedgerEntry(Base):
    """Append-only party ledger — opening balances, payments, and (once
    Purchase/Sales exist) purchase bills and sales invoices all post rows
    here. Never updated or deleted from app code, matching the audit-trail
    convention used for ims_stock_movements."""

    __tablename__ = "ims_ledger_entries"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    party_id = Column(String(36), ForeignKey("public.ims_parties.id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False)
    description = Column(String(500), nullable=False)
    reference = Column(String(200), nullable=True)
    debit = Column(Numeric(12, 2), nullable=False, default=0)
    credit = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<IMSLedgerEntry(party_id={self.party_id}, debit={self.debit}, credit={self.credit})>"
