from pydantic import BaseModel, ConfigDict, field_validator
from datetime import date, datetime
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


# ---------------------------------------------------------------------------
# Zones (floors / sections within a branch)
# ---------------------------------------------------------------------------

class ZoneData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    name: str
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateZoneRequest(BaseModel):
    name: str
    display_order: int = 0

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Zone name is required")
        return v


class UpdateZoneRequest(BaseModel):
    name: str | None = None
    display_order: int | None = None


# ---------------------------------------------------------------------------
# Tables (physical seating within a zone)
# ---------------------------------------------------------------------------

class TableData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    zone_id: str
    label: str
    status: str
    merge_id: str | None
    reservation_guest_name: str | None
    reservation_phone: str | None
    reservation_date: date | None
    reservation_time: str | None
    reservation_party_size: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateTableRequest(BaseModel):
    zone_id: str
    label: str

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Table label is required")
        return v


class UpdateTableRequest(BaseModel):
    label: str | None = None
    zone_id: str | None = None
    status: str | None = None


class ReserveTableRequest(BaseModel):
    guest_name: str
    phone: str | None = None
    date: date
    time: str
    party_size: int

    @field_validator("guest_name")
    @classmethod
    def guest_name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Guest name is required")
        return v

    @field_validator("time")
    @classmethod
    def time_format(cls, v: str) -> str:
        # Accept "HH:MM" 24-hour; frontend picker enforces this shape too.
        if not v or len(v) != 5 or v[2] != ":":
            raise ValueError("Time must be in HH:MM format")
        return v

    @field_validator("party_size")
    @classmethod
    def party_size_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Party size must be at least 1")
        return v


class MergeTablesRequest(BaseModel):
    table_ids: list[str]

    @field_validator("table_ids")
    @classmethod
    def at_least_two(cls, v: list[str]) -> list[str]:
        if len(v) < 2:
            raise ValueError("Provide at least two table IDs to merge")
        return v


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

class OrderLineData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    menu_item_id: str | None
    name: str
    variant_name: str | None
    price: Decimal
    qty: int
    note: str | None
    sent: bool
    is_voided: bool
    voided_reason: str | None
    created_at: datetime
    updated_at: datetime


class OrderData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    table_id: str | None
    type: str
    status: str
    kitchen_status: str
    placed_at: datetime
    placed_at_bs: str
    paid_at: datetime | None
    paid_at_bs: str | None
    discount_type: str
    discount_value: Decimal
    payment_method: str | None
    waiter_name: str
    waiter_cred_id: str | None
    delivery_customer_name: str | None
    delivery_phone: str | None
    delivery_address: str | None
    delivery_status: str | None
    created_at: datetime
    updated_at: datetime
    lines: list[OrderLineData] = []


class CreateOrderRequest(BaseModel):
    type: str
    table_id: str | None = None
    delivery_customer_name: str | None = None
    delivery_phone: str | None = None
    delivery_address: str | None = None

    @field_validator("type")
    @classmethod
    def type_valid(cls, v: str) -> str:
        if v not in ("dine-in", "delivery"):
            raise ValueError("type must be 'dine-in' or 'delivery'")
        return v


class AddOrderLineRequest(BaseModel):
    # Either menu_item_id (server snapshots name+price+variant validation),
    # OR name+price for a custom off-menu line.
    menu_item_id: str | None = None
    variant_name: str | None = None
    name: str | None = None
    price: Decimal | None = None
    qty: int = 1
    note: str | None = None

    @field_validator("qty")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("qty must be at least 1")
        return v


class UpdateOrderLineRequest(BaseModel):
    qty: int | None = None
    note: str | None = None


class VoidOrderLineRequest(BaseModel):
    reason: str | None = None


class SetKitchenStatusRequest(BaseModel):
    kitchen_status: str

    @field_validator("kitchen_status")
    @classmethod
    def valid(cls, v: str) -> str:
        if v not in ("new", "cooking", "ready", "served"):
            raise ValueError("kitchen_status must be one of: new, cooking, ready, served")
        return v


class SetDiscountRequest(BaseModel):
    discount_type: str
    discount_value: Decimal

    @field_validator("discount_type")
    @classmethod
    def type_valid(cls, v: str) -> str:
        if v not in ("percent", "flat"):
            raise ValueError("discount_type must be 'percent' or 'flat'")
        return v

    @field_validator("discount_value")
    @classmethod
    def value_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("discount_value can't be negative")
        return v


class MarkPaidRequest(BaseModel):
    payment_method: str

    @field_validator("payment_method")
    @classmethod
    def valid(cls, v: str) -> str:
        if v not in ("cash", "qr", "card"):
            raise ValueError("payment_method must be one of: cash, qr, card")
        return v


class SetDeliveryStatusRequest(BaseModel):
    delivery_status: str

    @field_validator("delivery_status")
    @classmethod
    def valid(cls, v: str) -> str:
        if v not in ("pending", "out", "delivered"):
            raise ValueError("delivery_status must be one of: pending, out, delivered")
        return v


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class InventoryItemData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    name: str
    category: str
    unit: str
    stock: Decimal
    threshold: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StockMovementData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    item_id: str
    type: str
    delta: Decimal
    reason: str
    note: str | None
    cost: Decimal | None
    actor_name: str
    actor_cred_id: str | None
    created_at: datetime


class CreateInventoryItemRequest(BaseModel):
    name: str
    category: str = "Other"
    unit: str = "piece"
    threshold: Decimal = Decimal("0")
    # Opening balance recorded as an "Initial stock" movement so the audit log
    # doesn't have a phantom starting quantity that no one restocked in.
    stock: Decimal = Decimal("0")

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Item name is required")
        return v


class UpdateInventoryItemRequest(BaseModel):
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    threshold: Decimal | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Item name is required")
        return v


class RestockRequest(BaseModel):
    qty: Decimal
    cost: Decimal | None = None
    note: str | None = None


class AdjustStockRequest(BaseModel):
    delta: Decimal
    reason: str
    note: str | None = None

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Reason is required")
        return v
