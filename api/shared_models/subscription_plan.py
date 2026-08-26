import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Numeric, Boolean, UniqueConstraint
from core.database import Base


class SubscriptionPlan(Base):
    """One row per (real app, billing cycle) — app_code is always a real
    app code (srota_pms | srota_rms | srota_ims | ...), never 'bundle'.
    There is no bundle SKU: buying 2+ apps together sums their individual
    prices here and applies PlatformSetting's bundle_discount_percent — see
    SubscriptionService.price_selection."""

    __tablename__ = "subscription_plans"
    __table_args__ = (
        UniqueConstraint("app_code", "plan", name="uq_subscription_plans_app_plan"),
        {"schema": "public"},
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    app_code = Column(String(50), nullable=False)
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


class PlatformSetting(Base):
    """Small key/value store for single-value platform config (right now
    just bundle_discount_percent — the % knocked off the summed individual
    app prices when a tenant buys 2+ apps together in one purchase). One
    row per key, superadmin-editable. Not meant for anything with structure
    beyond a single string/number value — a real feature gets its own table."""

    __tablename__ = "platform_settings"
    __table_args__ = ({"schema": "public"},)

    key = Column(String(100), primary_key=True)
    value = Column(String(500), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
