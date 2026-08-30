from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from datetime import datetime, timezone
import uuid
from core.database import Base


class PMSGuest(Base):
    __tablename__ = "pms_guests"
    __table_args__ = (
        Index("ix_pms_guest_tenant_name", "tenant_id", "full_name"),
        Index("ix_pms_guest_tenant_phone", "tenant_id", "phone"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    id_document_type = Column(String(50), nullable=True)
    id_document_number = Column(String(100), nullable=True)
    nationality = Column(String(100), nullable=True)
    pan = Column(String(50), nullable=True)   # buyer PAN/VAT for B2B tax invoices
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<PMSGuest(name={self.full_name}, tenant_id={self.tenant_id})>"
