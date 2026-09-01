from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index, Text, text
from sqlalchemy.sql import func
import uuid
from core.database import Base


class CbmsSyncLog(Base):
    """One row per CBMS sync ATTEMPT (not per document) — a single invoice
    can be retried several times before it succeeds, and the sync-status
    view needs that history, not just a final state. Per
    docs/Srota_IRD_Compliance_Checklist.md's DB design section.

    source_app is kept separate per app even though org_tax_settings is
    shared — IMS and RMS don't share sync history, only credentials."""

    __tablename__ = "cbms_sync_log"
    __table_args__ = (
        # The checklist's explicit DB-level integrity rule: never let the
        # same document be marked synced twice. IRD's own "already exists"
        # response (code 101) is a second, independent layer of protection
        # on top of this, not a replacement for it.
        Index(
            "uq_cbms_sync_log_synced_document",
            "source_app",
            "document_id",
            unique=True,
            postgresql_where=text("status = 'synced'"),
        ),
        Index("ix_cbms_sync_log_tenant_app_status", "tenant_id", "source_app", "status"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    source_app = Column(String(20), nullable=False)  # "ims" | "restro"
    document_type = Column(String(20), nullable=False)  # "invoice" | "credit_note"
    document_id = Column(String(36), nullable=False, index=True)
    document_number = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending|synced|failed
    cbms_response_code = Column(String(20), nullable=True)
    cbms_response_body = Column(Text, nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    last_attempted_at = Column(DateTime(timezone=True), nullable=True)
    synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<CbmsSyncLog(source_app={self.source_app}, document_id={self.document_id}, status={self.status})>"
