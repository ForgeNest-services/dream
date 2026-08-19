from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from decimal import Decimal
from features.ims.roles import IMSRole


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
        if v not in IMSRole.values():
            raise ValueError(f"Invalid role. Must be one of: {IMSRole.values()}")
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
    parent_id: str | None
    name: str
    created_at: datetime
    updated_at: datetime


class CreateCategoryRequest(BaseModel):
    name: str
    parent_id: str | None = None


class UpdateCategoryRequest(BaseModel):
    name: str


class BrandData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    created_at: datetime
    updated_at: datetime


class CreateBrandRequest(BaseModel):
    name: str


class UnitData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    symbol: str
    allows_decimals: bool
    created_at: datetime
    updated_at: datetime


class VariantStockEntry(BaseModel):
    branch_id: str
    qty: Decimal


class VariantData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    name: str
    model_no: str | None
    barcode: str | None
    unit_id: str
    purchase_unit_id: str | None
    conversion_factor: Decimal | None
    cost_price: Decimal
    selling_price: Decimal
    low_stock_at: int
    stock: list[VariantStockEntry] = []

    @classmethod
    def from_orm_with_stock(cls, variant) -> "VariantData":
        data = cls.model_validate(variant)
        data.stock = [
            VariantStockEntry(branch_id=r.branch_id, qty=r.qty) for r in variant.stock_rows
        ]
        return data


class VariantInput(BaseModel):
    id: str | None = None
    name: str = "Default"
    model_no: str | None = None
    barcode: str | None = None
    unit_id: str
    purchase_unit_id: str | None = None
    conversion_factor: Decimal | None = None
    cost_price: Decimal = Decimal(0)
    selling_price: Decimal = Decimal(0)
    low_stock_at: int = 10
    # Only meaningful on create — ignored on update (see product_service.update).
    initial_stock: Decimal = Decimal(0)


class ProductData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    sku: str
    category_id: str
    brand_id: str | None
    media_id: str | None
    description: str | None
    taxable: bool | None
    tax_rate: Decimal | None
    created_at: datetime
    updated_at: datetime
    variants: list[VariantData] = []

    @classmethod
    def from_orm_with_variants(cls, product) -> "ProductData":
        data = cls.model_validate(product)
        data.variants = [VariantData.from_orm_with_stock(v) for v in product.variants]
        return data


class CreateProductRequest(BaseModel):
    name: str
    sku: str
    category_id: str
    brand_id: str | None = None
    media_id: str | None = None
    description: str | None = None
    taxable: bool = True
    tax_rate: Decimal | None = None
    branch_id_for_stock: str
    variants: list[VariantInput]


class UpdateProductRequest(BaseModel):
    name: str
    sku: str
    category_id: str
    brand_id: str | None = None
    media_id: str | None = None
    description: str | None = None
    taxable: bool = True
    tax_rate: Decimal | None = None
    variants: list[VariantInput]


class StockMovementData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    date: datetime
    branch_id: str
    product_id: str
    variant_id: str
    type: str
    qty: Decimal
    unit_cost: Decimal | None
    balance_after: Decimal
    reason: str | None
    reference: str | None
    supplier_id: str | None
    user_id: str
    created_at: datetime


class AdjustStockRequest(BaseModel):
    variant_id: str
    branch_id: str
    qty: Decimal
    reason: str
    date: datetime


class RestockRequest(BaseModel):
    variant_id: str
    branch_id: str
    qty: Decimal
    unit_cost: Decimal
    date: datetime
    supplier_id: str | None = None
    reference: str | None = None


class MediaData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    url: str
    folder: str
    size_kb: int
    uploaded_at: datetime
