from pydantic import BaseModel, ConfigDict, EmailStr


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class BusinessRegisterRequest(BaseModel):
    business_name: str
    business_address: str
    pan: str = None
    is_vat_registered: bool = False
    business_phone: str = None
    business_email: EmailStr = None


class UpdateTaxInfoRequest(BaseModel):
    pan: str = None
    is_vat_registered: bool = None


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


class TokenData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


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
