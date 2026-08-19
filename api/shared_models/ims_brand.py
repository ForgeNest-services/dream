from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSBrand(Base):
    __tablename__ = "ims_brands"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_ims_brand_tenant_name"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<IMSBrand(tenant_id={self.tenant_id}, name={self.name})>"
