from sqlalchemy import Column, String, Boolean, Numeric, DateTime, ForeignKey, Index
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroBranchSettings(Base):
    """Per-branch runtime settings — tax and payment-QR config that used to
    live purely on the client. Exactly one row per branch (enforced by the
    unique index on branch_id); auto-provisioned on first read."""

    __tablename__ = "restro_branch_settings"
    __table_args__ = (
        Index("uq_restro_branch_settings_branch", "branch_id", unique=True),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False)
    # Whether to actually apply VAT on bills. Gated by the tenant's
    # is_vat_registered flag on the frontend — if the tenant isn't
    # VAT-registered, this stays off no matter what.
    vat_enabled = Column(Boolean, nullable=False, default=True)
    vat_rate = Column(Numeric(5, 2), nullable=False, default=13)
    # Public MinIO URL of the branch's payment QR image. NULL = no QR set.
    # Old file is deleted from storage whenever this is replaced or cleared
    # (see BranchSettingsService.update_qr / clear_qr).
    qr_image_url = Column(String(1000), nullable=True)
    # IRD: when True, every VAT bill is pushed to CBMS in real-time at
    # mark-paid time. Only meaningful for VAT-registered tenants (enforced in
    # BranchSettingsService.update). Defaults off — the owner explicitly opts
    # in once they have CBMS credentials configured.
    cbms_realtime_enabled = Column(Boolean, nullable=False, default=False)
    # IRD Annex-6: all bill formats (full tax, abbreviated, PAN-only) require
    # an HS code column per line. Restaurants use a branch-level default
    # (e.g. "2106.90" for prepared foods) rather than per-item codes.
    default_hs_code = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<RestroBranchSettings(branch_id={self.branch_id})>"
