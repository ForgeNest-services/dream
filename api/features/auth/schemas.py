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


class GoogleCallbackRequest(BaseModel):
    id_token: str


class GoogleCompleteRequest(BaseModel):
    email: EmailStr
    full_name: str
    business_name: str
    picture_url: str = None


class GoogleCallbackResponse(BaseModel):
    user_exists: bool
    email: str
    name: str = None
    picture: str = None
    user: UserData = None
    tokens: TokenData = None
