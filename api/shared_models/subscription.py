import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, DateTime, Numeric, Text, ForeignKey,
    UniqueConstraint, CheckConstraint, Integer,
)
from core.database import Base


class AppSubscription(Base):
    __tablename__ = "app_subscriptions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "app_code", name="uq_app_subscriptions_tenant_app"),
        CheckConstraint(
            "status IN ('trialing','active','expired','cancelled')",
            name="ck_app_subscriptions_status",
        ),
        CheckConstraint(
            "plan IS NULL OR plan IN ('monthly','yearly','bundle')",
            name="ck_app_subscriptions_plan",
        ),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("public.tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    app_code = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="trialing")
    plan = Column(String(20), nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    period_start = Column(DateTime(timezone=True), nullable=True)
    period_end = Column(DateTime(timezone=True), nullable=True)
    price_npr = Column(Numeric(10, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SubscriptionPayment(Base):
    __tablename__ = "subscription_payments"
    __table_args__ = (
        CheckConstraint(
            "plan IN ('monthly','yearly','bundle')",
            name="ck_subscription_payments_plan",
        ),
        CheckConstraint(
            "status IN ('pending','confirmed','rejected')",
            name="ck_subscription_payments_status",
        ),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("public.tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    app_code = Column(String(50), nullable=False)
    amount_npr = Column(Numeric(10, 2), nullable=False)
    plan = Column(String(20), nullable=False)
    period_months = Column(Integer, nullable=False, default=1)
    payment_method = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    notes = Column(Text, nullable=True)
    confirmed_by = Column(String, ForeignKey("public.platform_admins.id", ondelete="SET NULL"), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
