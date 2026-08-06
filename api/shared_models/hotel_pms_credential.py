from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime, timezone
import uuid
from core.database import Base


class HotelPMSCredential(Base):
    __tablename__ = "hotel_pms_credentials"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "branch_id", "role", name="uq_hotel_pms_tenant_branch_role"
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(
        String(36), ForeignKey("public.branches.id"), nullable=True, index=True
    )
    role = Column(String(50), nullable=False)
    username = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_by = Column(String(36), ForeignKey("public.users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<HotelPMSCredential(tenant_id={self.tenant_id}, branch_id={self.branch_id}, role={self.role})>"
