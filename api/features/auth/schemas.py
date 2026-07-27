from pydantic import BaseModel, ConfigDict, EmailStr


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    business_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    is_owner: bool
    tenant_id: str


class TenantData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class TokenData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
