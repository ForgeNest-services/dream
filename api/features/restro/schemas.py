from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from decimal import Decimal
from features.restro.roles import RestroRole


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
        if v not in RestroRole.values():
            raise ValueError(f"Invalid role. Must be one of: {RestroRole.values()}")
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


class CategoryData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    name: str
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateCategoryRequest(BaseModel):
    name: str
    display_order: int = 0

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Category name is required")
        return v


class UpdateCategoryRequest(BaseModel):
    name: str | None = None
    display_order: int | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Category name is required")
        return v


class VariantData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    price: Decimal


class VariantInput(BaseModel):
    name: str
    price: Decimal

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Variant name is required")
        return v

    @field_validator("price")
    @classmethod
    def price_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Price cannot be negative")
        return v


class MenuItemData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    category_id: str
    name: str
    image_url: str | None
    has_variants: bool
    price: Decimal | None
    sold_out: bool
    is_active: bool
    variants: list[VariantData]
    created_at: datetime
    updated_at: datetime


class CreateMenuItemRequest(BaseModel):
    category_id: str
    name: str
    has_variants: bool = False
    price: Decimal | None = None
    image_url: str | None = None
    variants: list[VariantInput] = []

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Item name is required")
        return v

    @field_validator("price")
    @classmethod
    def price_non_negative(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError("Price cannot be negative")
        return v


class UpdateMenuItemRequest(BaseModel):
    category_id: str | None = None
    name: str | None = None
    has_variants: bool | None = None
    price: Decimal | None = None
    clear_price: bool = False
    image_url: str | None = None
    variants: list[VariantInput] | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Item name is required")
        return v

    @field_validator("price")
    @classmethod
    def price_non_negative(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError("Price cannot be negative")
        return v


class SetSoldOutRequest(BaseModel):
    sold_out: bool
