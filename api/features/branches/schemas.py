from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BranchData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    address: str | None
    city: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateBranchRequest(BaseModel):
    name: str
    address: str | None = None
    city: str | None = None
    phone: str | None = None


class UpdateBranchRequest(BaseModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None
