from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from features.hotel_pms.roles import HotelPMSRole


class CredentialData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str | None
    role: str
    username: str
    created_by: str
    created_at: datetime
    updated_at: datetime


class CreateCredentialRequest(BaseModel):
    role: str
    username: str
    password: str
    branch_id: str | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in HotelPMSRole.values():
            raise ValueError(f"Invalid role. Must be one of: {HotelPMSRole.values()}")
        return v

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UpdateCredentialRequest(BaseModel):
    username: str | None = None
    password: str | None = None

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class StaffLoginRequest(BaseModel):
    username: str
    password: str


class StaffLoginResponse(BaseModel):
    token: str
    role: str
    tenant_id: str
    branch_id: str | None
    expires_at: datetime


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
