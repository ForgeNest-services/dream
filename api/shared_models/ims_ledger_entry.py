from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSLedgerEntry(Base):
    """Party ledger — opening balances, payments, and (once Purchase/Sales
    exist) purchase bills and sales invoices all post rows here. Real
    transactions (payments, bills) are append-only and never mutated. The
    one exception: the "Opening balance" entry a party creates on save may
    be corrected in place when the owner edits that party's opening_balance
    field later, so the two numbers never silently disagree — see
    IMSPartyService.update. Deleting a party cascades to delete its entries
    (see IMSParty.ledger_entries)."""

    __tablename__ = "ims_ledger_entries"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    party_id = Column(
        String(36), ForeignKey("public.ims_parties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = Column(DateTime, nullable=False)
    description = Column(String(500), nullable=False)
    reference = Column(String(200), nullable=True)
    debit = Column(Numeric(12, 2), nullable=False, default=0)
    credit = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<IMSLedgerEntry(party_id={self.party_id}, debit={self.debit}, credit={self.credit})>"
