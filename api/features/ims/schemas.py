from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import date, datetime
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
    expiry_date: date | None = None
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
    expiry_date: date | None = None
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
    date_bs: str
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


class FiscalYearData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    start_year: int
    is_active: bool
    created_at: datetime


class CreateFiscalYearRequest(BaseModel):
    start_year: int


class PartyData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    kind: str
    phone: str | None
    email: str | None
    address: str | None
    pan: str | None
    is_vat_registered: bool | None
    credit_limit: Decimal | None
    opening_balance: Decimal
    terms: str | None
    created_at: datetime
    updated_at: datetime


class CreatePartyRequest(BaseModel):
    name: str
    kind: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    pan: str | None = None
    is_vat_registered: bool | None = None
    credit_limit: Decimal | None = None
    opening_balance: Decimal = Decimal(0)
    terms: str | None = None

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        if v not in ("supplier", "customer"):
            raise ValueError("kind must be 'supplier' or 'customer'")
        return v


class UpdatePartyRequest(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    pan: str | None = None
    is_vat_registered: bool | None = None
    credit_limit: Decimal | None = None
    opening_balance: Decimal = Decimal(0)
    terms: str | None = None


class LedgerEntryData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    party_id: str
    date: datetime
    description: str
    reference: str | None
    debit: Decimal
    credit: Decimal


class RecordPaymentRequest(BaseModel):
    party_id: str
    amount: Decimal
    date: datetime
    method: str
    reference: str | None = None


class PurchaseLineData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    variant_id: str
    description: str
    qty: Decimal
    unit_id: str
    unit_cost: Decimal
    taxable: bool
    tax_rate: Decimal
    vat_amount: Decimal


class PurchaseData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    number: str
    date: datetime
    date_bs: str
    fiscal_year_id: str | None
    branch_id: str
    party_id: str | None
    bill_no: str | None
    items_total: Decimal
    bill_amount: Decimal
    paid_amount: Decimal
    payment_method: str
    post_to_ledger: bool
    note: str | None
    user_id: str
    created_at: datetime
    lines: list[PurchaseLineData]


class CostHistoryEntry(BaseModel):
    date: datetime
    date_bs: str
    unit_cost: Decimal
    qty: Decimal
    purchase_id: str
    purchase_number: str
    bill_no: str | None


class PurchaseNewItemRow(BaseModel):
    name: str = ""
    model_no: str = ""
    barcode: str = ""
    unit_id: str
    qty: Decimal
    unit_cost: Decimal
    selling_price: Decimal = Decimal(0)
    low_stock_at: int = 10
    expiry_date: date | None = None


class PurchaseExistingItemRow(BaseModel):
    variant_id: str
    qty: Decimal
    unit_cost: Decimal
    selling_price: Decimal = Decimal(0)
    expiry_date: date | None = None


class PurchaseNewItem(BaseModel):
    kind: Literal["new"] = "new"
    name: str
    sku: str
    category_id: str
    brand_id: str | None = None
    media_id: str | None = None
    taxable: bool = True
    tax_rate: Decimal | None = None
    rows: list[PurchaseNewItemRow]


class PurchaseExistingItem(BaseModel):
    kind: Literal["existing"] = "existing"
    product_id: str
    rows: list[PurchaseExistingItemRow]


class CreatePurchaseRequest(BaseModel):
    date: datetime
    branch_id: str
    party_id: str | None = None
    bill_no: str | None = None
    note: str | None = None
    bill_amount: Decimal = Decimal(0)
    paid_amount: Decimal = Decimal(0)
    payment_method: str = "cash"
    post_to_ledger: bool = False
    items: list[Annotated[Union[PurchaseNewItem, PurchaseExistingItem], Field(discriminator="kind")]]
    # Frontend's company.vatRate fallback for taxable lines with no explicit
    # rate — CompanyProfile isn't a backend table yet, so this rides along
    # on the request instead of being looked up server-side.
    default_vat_rate: Decimal = Decimal(13)


class InvoiceLineData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    variant_id: str
    description: str
    qty: Decimal
    unit_id: str
    rate: Decimal
    discount: Decimal
    taxable: bool
    tax_rate: Decimal
    vat_amount: Decimal


class InvoiceData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    number: str
    kind: str
    date: datetime
    date_bs: str
    fiscal_year_id: str | None
    branch_id: str
    customer_id: str
    gross_amount: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    exempt_amount: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    payment_method: str
    paid_amount: Decimal
    status: str
    note: str | None
    user_id: str
    created_at: datetime
    lines: list[InvoiceLineData]


class InvoiceLineInput(BaseModel):
    variant_id: str
    qty: Decimal
    rate: Decimal
    discount: Decimal = Decimal(0)
    taxable: bool = True


class CreateInvoiceRequest(BaseModel):
    date: datetime
    branch_id: str
    customer_id: str
    payment_method: str = "cash"
    paid_amount: Decimal = Decimal(0)
    note: str | None = None
    lines: list[InvoiceLineInput]
    # CompanyProfile isn't a backend table yet — same pattern as
    # CreatePurchaseRequest.default_vat_rate.
    vat_registered: bool = False
    vat_rate: Decimal = Decimal(13)
    invoice_prefix: str = "INV"
    # A quotation is a price offer only — no stock deduction, no ledger
    # post. Those happen for real on IMSInvoiceService.convert.
    is_quotation: bool = False
    # Display-only: does this bill show its Taxable/VAT breakdown ("tax"
    # invoice) or not ("abbreviated")? Independent of vat_registered, which
    # always drives the real total — see IMSInvoiceService.create's comment.
    # None (the default) falls back to vat_registered, matching every
    # caller from before this field existed.
    show_vat_breakdown: bool | None = None


class ConvertQuotationRequest(BaseModel):
    payment_method: str = "cash"
    paid_amount: Decimal = Decimal(0)
    vat_registered: bool = False
    vat_rate: Decimal = Decimal(13)
    invoice_prefix: str = "INV"
    show_vat_breakdown: bool | None = None


class BranchSettingsData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    vat_enabled: bool
    vat_rate: Decimal
    qr_image_url: str | None
    created_at: datetime
    updated_at: datetime


class UpdateBranchSettingsRequest(BaseModel):
    vat_enabled: bool | None = None
    vat_rate: Decimal | None = None
    qr_image_url: str | None = None
    clear_qr: bool = False
