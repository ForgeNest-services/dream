import re
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str


def _validate_pan(v: str | None) -> str | None:
    """Nepali PAN is exactly 9 digits — enforced here (not just in the
    onboarding form's UI) since this value is trusted as-is onto every
    invoice a business issues; a client bypassing the frontend regex must
    still be rejected server-side."""
    if v is None or v == "":
        return None
    if not re.fullmatch(r"\d{9}", v):
        raise ValueError("PAN must be exactly 9 digits")
    return v


def _blank_to_none(v: str | None) -> str | None:
    """These are all optional columns with nullable-unique DB constraints
    (see Tenant model) — an empty string from an untouched optional form
    field must normalize to NULL, not fail EmailStr validation or get
    stored as a literal empty string that could collide with another
    tenant's genuinely-empty field under the unique index."""
    return None if v == "" else v


class BusinessRegisterRequest(BaseModel):
    business_name: str
    business_address: str
    pan: str | None = None
    is_vat_registered: bool = False
    business_phone: str | None = None
    business_email: EmailStr | None = None

    _validate_pan = field_validator("pan")(_validate_pan)
    _blank_phone = field_validator("business_phone", mode="before")(_blank_to_none)
    _blank_email = field_validator("business_email", mode="before")(_blank_to_none)


class UpdateTaxInfoRequest(BaseModel):
    pan: str | None = None
    is_vat_registered: bool | None = None

    _validate_pan = field_validator("pan")(_validate_pan)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    is_owner: bool
    tenant_id: str | None = None
    role: str | None = None
    picture_url: str | None = None


class TenantData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    pan: str | None = None
    is_vat_registered: bool = False
    business_address: str | None = None
    business_phone: str | None = None
    business_email: str | None = None
    logo_url: str | None = None


class TokenData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class GoogleCallbackRequest(BaseModel):
    id_token: str


class GoogleCompleteRequest(BaseModel):
    email: EmailStr
    full_name: str
    picture_url: str = None


class GoogleCallbackResponse(BaseModel):
    user_exists: bool
    email: str
    name: str = None
    picture: str = None
    user: UserData = None
    tokens: TokenData = None


class CreateTeamMemberRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str


class ResendOTPRequest(BaseModel):
    email: EmailStr
