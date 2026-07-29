from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, UniqueConstraint
from datetime import datetime, timezone
import uuid
from core.database import Base


class ModuleSubscription(Base):
    __tablename__ = "module_subscriptions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "module_id", name="uq_tenant_module"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False)
    module_id = Column(String(36), ForeignKey("public.modules.id"), nullable=False)
    plan_type = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="trial")
    trial_started_at = Column(DateTime, nullable=True)
    trial_expires_at = Column(DateTime, nullable=True)
    amount_charged = Column(Numeric(10, 2), nullable=True)
    starts_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    ends_at = Column(DateTime, nullable=False)
    payment_reference = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<ModuleSubscription(tenant_id={self.tenant_id}, module_id={self.module_id}, status={self.status})>"
