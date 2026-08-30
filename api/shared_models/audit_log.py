"""Append-only audit log — IRD Electronic Billing Procedure 2074 requirement.

DB grants: INSERT + SELECT only.  Never UPDATE or DELETE this table.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, JSON, Index, ForeignKey
from core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_tenant_entity", "tenant_id", "entity_type", "entity_id"),
        Index("ix_audit_log_created_at", "created_at"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id", ondelete="CASCADE"), nullable=False)
    app_code = Column(String(50), nullable=False)               # 'hotel_pms', 'restro', …
    entity_type = Column(String(100), nullable=False)           # 'booking', 'invoice', …
    entity_id = Column(String(36), nullable=False)
    action = Column(String(50), nullable=False)                 # 'create','update','void','cancel','login'

    performed_by = Column(String(36), nullable=False)           # user_id or cred_id
    performer_type = Column(String(20), nullable=False)         # 'platform_user' | 'staff'

    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)

    # IRD-mandated machine metadata
    terminal_ip = Column(String(45), nullable=True)             # IPv4 or IPv6
    mac_address = Column(String(17), nullable=True)             # client-supplied; nullable for web

    # Append-only: no updated_at
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AuditLog({self.action} {self.entity_type}/{self.entity_id})>"
