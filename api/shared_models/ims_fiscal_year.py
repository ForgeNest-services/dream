from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSFiscalYear(Base):
    """Tenant-scoped fiscal year, identified by its Bikram Sambat start year
    (Shrawan 1 of start_year through Ashad end of start_year+1). Only the
    start_year is stored — label/start_date/end_date are BS<->AD calendar
    derivations already implemented client-side (src/lib/nepali-date.ts) and
    are recomputed there rather than duplicated in Python."""

    __tablename__ = "ims_fiscal_years"
    __table_args__ = (
        UniqueConstraint("tenant_id", "start_year", name="uq_ims_fiscal_year_tenant_start_year"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    start_year = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<IMSFiscalYear(tenant_id={self.tenant_id}, start_year={self.start_year})>"
