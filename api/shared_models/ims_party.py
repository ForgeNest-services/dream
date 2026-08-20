from sqlalchemy import Column, String, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSParty(Base):
    """Tenant-wide customer or supplier — kind discriminates. Same table for
    both, matching the mock model's single Party type with a kind field."""

    __tablename__ = "ims_parties"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    kind = Column(String(20), nullable=False)  # "supplier" | "customer"
    phone = Column(String(30), nullable=True)
    email = Column(String(200), nullable=True)
    address = Column(String(500), nullable=True)
    pan = Column(String(30), nullable=True)
    is_vat_registered = Column(Boolean, nullable=True)
    credit_limit = Column(Numeric(12, 2), nullable=True)
    opening_balance = Column(Numeric(12, 2), nullable=False, default=0)
    terms = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    ledger_entries = relationship(
        "IMSLedgerEntry",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self):
        return f"<IMSParty(tenant_id={self.tenant_id}, name={self.name}, kind={self.kind})>"
