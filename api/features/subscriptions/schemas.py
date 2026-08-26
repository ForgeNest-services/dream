from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class SubscriptionData(BaseModel):
    id: str
    tenant_id: str
    app_code: str
    status: str
    plan: str | None
    trial_ends_at: datetime | None
    period_start: datetime | None
    period_end: datetime | None
    price_npr: Decimal | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionWithTenantData(SubscriptionData):
    tenant_name: str
    tenant_email: str | None


class PaymentData(BaseModel):
    id: str
    group_id: str
    tenant_id: str
    app_code: str
    amount_npr: Decimal
    plan: str
    period_months: int
    payment_method: str | None
    status: str
    notes: str | None
    confirmed_by: str | None
    confirmed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentGroupData(BaseModel):
    """One purchase request — a single app is a group of one row; a bundle
    purchase (2+ apps) is N rows sharing one group_id (see SubscriptionPayment's
    docstring). This is the shape the superadmin's payment queue works with,
    so a bundle request shows and confirms/rejects as one unit."""
    group_id: str
    tenant_id: str
    tenant_name: str
    plan: str
    status: str
    payment_method: str | None
    created_at: datetime
    payments: list[PaymentData]


class PlanData(BaseModel):
    id: str
    app_code: str
    plan: str
    price_npr: Decimal
    label: str
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class BundleDiscountData(BaseModel):
    percent: Decimal


class PriceQuoteLine(BaseModel):
    app_code: str
    amount_npr: Decimal


class PriceQuoteData(BaseModel):
    lines: list[PriceQuoteLine]
    subtotal_npr: Decimal
    discount_percent: Decimal
    discount_amount_npr: Decimal
    total_npr: Decimal


class PriceQuoteRequest(BaseModel):
    app_codes: list[str]
    plan: str  # monthly | yearly


class SubmitPaymentRequest(BaseModel):
    app_codes: list[str]
    plan: str  # monthly | yearly
    payment_method: str | None = None
    notes: str | None = None


class ConfirmPaymentRequest(BaseModel):
    notes: str | None = None


class ManuallyActivateRequest(BaseModel):
    tenant_id: str
    app_code: str
    plan: str  # monthly | yearly
    months: int = 1
    price_npr: float
    notes: str | None = None


class ExtendTrialRequest(BaseModel):
    tenant_id: str
    app_code: str
    extra_days: int = 30


class CreatePlanRequest(BaseModel):
    app_code: str
    plan: str  # monthly | yearly
    price_npr: float
    label: str


class UpdatePlanRequest(BaseModel):
    price_npr: float | None = None
    label: str | None = None
    is_active: bool | None = None


class UpdateBundleDiscountRequest(BaseModel):
    percent: Decimal
