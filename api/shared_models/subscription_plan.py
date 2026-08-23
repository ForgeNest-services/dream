import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Numeric, Boolean, UniqueConstraint
from core.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    __table_args__ = (
        UniqueConstraint("app_code", "plan", name="uq_subscription_plans_app_plan"),
        {"schema": "public"},
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    app_code = Column(String(50), nullable=False)   # srota_pms | srota_rms | srota_ims | bundle
    plan = Column(String(20), nullable=False)        # monthly | yearly
    price_npr = Column(Numeric(10, 2), nullable=False)
    label = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
