from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSUnit(Base):
    __tablename__ = "ims_units"
    __table_args__ = (
        UniqueConstraint("tenant_id", "symbol", name="uq_ims_unit_tenant_symbol"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False)
    allows_decimals = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<IMSUnit(tenant_id={self.tenant_id}, symbol={self.symbol})>"
