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


class PaymentWithTenantData(PaymentData):
    tenant_name: str


class PlanData(BaseModel):
    id: str
    app_code: str
    plan: str
    price_npr: Decimal
    label: str
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubmitPaymentRequest(BaseModel):
    app_code: str
    plan: str  # monthly | yearly
    payment_method: str | None = None
    notes: str | None = None


class ConfirmPaymentRequest(BaseModel):
    notes: str | None = None


class ManuallyActivateRequest(BaseModel):
    tenant_id: str
    app_code: str
    plan: str  # monthly | yearly | bundle
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
