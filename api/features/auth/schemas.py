from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    business_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserData(BaseModel):
    id: str
    full_name: str
    email: str
    is_owner: bool
    tenant_id: str

    class Config:
        from_attributes = True


class TenantData(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class TokenData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
