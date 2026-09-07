from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BranchData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    # IRD: Electronic Billing Procedure 2082, clause 6.2ग — identifies this
    # outlet in printed bill numbers once a tenant has 2+ branches. Unique
    # per tenant, auto-derived from the name on creation, editable after.
    code: str
    address: str | None
    city: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TenantInfoData(BaseModel):
    """Business identity shared by every branch — PAN/VAT status live on
    tenants, not branches (see CLAUDE.md §2.9: "Invoices use tenant.pan
    (business) + branch.address (which location issued it)"). Returned
    alongside GET /branches so any staff app (pms/restro/ims) can print a
    receipt with real business info without needing a platform JWT."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    pan: str | None
    is_vat_registered: bool
    business_address: str | None
    business_phone: str | None
    business_email: str | None
    logo_url: str | None


class CreateBranchRequest(BaseModel):
    name: str
    # Optional — auto-derived from `name` if omitted (see
    # BranchService.derive_unique_code). Owner can override at creation or
    # edit it later via UpdateBranchRequest.
    code: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None


class UpdateBranchRequest(BaseModel):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None
