from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
import uuid
from core.database import Base


class OrgTaxSettings(Base):
    """One row per tenant — the single, shared home for IRD/CBMS tax
    settings. Per docs/Srota_IRD_Compliance_Checklist.md: entered once from
    admin/ (platform JWT, Owner-only), read by every app (IMS, RMS, ...)
    that needs to submit bills to CBMS. Replaces the old per-app
    IMSCbmsCredential table — see features/tax_settings/.

    `pan` mirrors tenants.pan (kept here too so this record is
    self-contained for CBMS payload building, per the checklist's own DB
    design) — always written from tenants.pan at save time, never
    independently editable from this table's own UI."""

    __tablename__ = "org_tax_settings"
    __table_args__ = {"schema": "public"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, unique=True, index=True)
    pan = Column(String(50), nullable=True)
    ird_username = Column(String(255), nullable=True)
    # Encrypted at rest via core/crypto.py — never plaintext, never logged.
    ird_password = Column(String(500), nullable=True)
    # Off by default; only settable once credentials exist (enforced in
    # TaxSettingsService, not just here) and only while the relevant app's
    # certification flag is on (see core/configs.py IMS_CBMS_CERTIFIED /
    # RMS_CBMS_CERTIFIED).
    cbms_sync_enabled = Column(Boolean, nullable=False, default=False)
    # Stamped when the Owner accepts the "this is your live tax portal
    # login" disclosure — required before credentials can be saved at all.
    consent_acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    # Bumped on every credential save — lets the sync-status view tell
    # "failed because the password went stale after this date" apart from
    # a one-off network blip.
    credentials_updated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<OrgTaxSettings(tenant_id={self.tenant_id})>"
