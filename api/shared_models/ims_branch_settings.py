from sqlalchemy import Column, String, Boolean, Numeric, DateTime, ForeignKey, Index
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSBranchSettings(Base):
    """Per-branch runtime settings — whether VAT is currently applied on
    bills, and at what rate. Exactly one row per branch (enforced by the
    unique index on branch_id); auto-provisioned on first read. Same shape
    as restro_branch_settings (see api/features/restro/branch_settings_*).

    vat_enabled is gated on the frontend by the tenant's is_vat_registered
    flag (from GET /branches's meta.tenant) — a PAN-only business can never
    turn this on, since VAT can't be charged without VAT registration."""

    __tablename__ = "ims_branch_settings"
    __table_args__ = (
        Index("uq_ims_branch_settings_branch", "branch_id", unique=True),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False)
    vat_enabled = Column(Boolean, nullable=False, default=True)
    vat_rate = Column(Numeric(5, 2), nullable=False, default=13)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<IMSBranchSettings(branch_id={self.branch_id})>"
