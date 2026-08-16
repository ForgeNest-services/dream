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


class MenuItemComponentData(BaseModel):
    """A component of a combo, serialized with the child item's name so the
    frontend can render "2× Steam Momo (Chicken)" without a second lookup."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    child_menu_item_id: str
    child_variant_name: str | None
    qty: int
    display_order: int
    # Populated via @model_validator below from the joined child relationship.
    child_name: str = ""


class MenuItemComponentInput(BaseModel):
    child_menu_item_id: str
    child_variant_name: str | None = None
    qty: int = 1

    @field_validator("qty")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("qty must be at least 1")
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
    is_combo: bool
    price: Decimal | None
    sold_out: bool
    is_active: bool
    variants: list[VariantData]
    components: list[MenuItemComponentData] = []
    created_at: datetime
    updated_at: datetime


class CreateMenuItemRequest(BaseModel):
    category_id: str
    name: str
    has_variants: bool = False
    is_combo: bool = False
    price: Decimal | None = None
    image_url: str | None = None
    variants: list[VariantInput] = []
    components: list[MenuItemComponentInput] = []

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
    is_combo: bool | None = None
    price: Decimal | None = None
    clear_price: bool = False
    image_url: str | None = None
    variants: list[VariantInput] | None = None
    components: list[MenuItemComponentInput] | None = None

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


class OrderCustomerRef(BaseModel):
    """Slim customer view embedded in Order responses — enough to show a
    label without a second round-trip, without dragging full CustomerData
    everywhere."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    phone: str | None
    address: str | None


class OrderData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    table_id: str | None
    customer_id: str | None
    bill_number: int
    type: str
    status: str
    kitchen_status: str
    placed_at: datetime
    placed_at_bs: str
    paid_at: datetime | None
    paid_at_bs: str | None
    settled_at: datetime | None
    settled_at_bs: str | None
    discount_type: str
    discount_value: Decimal
    payment_method: str | None
    waiter_name: str
    waiter_cred_id: str | None
    delivery_status: str | None
    customer: OrderCustomerRef | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[OrderLineData] = []


class CreateOrderRequest(BaseModel):
    type: str
    table_id: str | None = None
    # Required for delivery, optional for dine-in.
    customer_id: str | None = None

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


class SetOrderCustomerRequest(BaseModel):
    # null = clear the current customer attachment.
    customer_id: str | None = None


class MarkPaidRequest(BaseModel):
    payment_method: str
    # Required when payment_method == 'khata' and the order doesn't already
    # have customer_id attached (delivery orders do). Ignored for cash/qr.
    customer_id: str | None = None

    @field_validator("payment_method")
    @classmethod
    def valid(cls, v: str) -> str:
        if v not in ("cash", "qr", "khata"):
            raise ValueError("payment_method must be one of: cash, qr, khata")
        return v


class CreateKhataSettlementRequest(BaseModel):
    """A partial or full payment against a customer's khata balance."""

    amount: Decimal
    # cash | qr — how the customer handed over the money. Khata isn't valid
    # (that'd be circular).
    method: str
    note: str | None = None

    @field_validator("method")
    @classmethod
    def method_valid(cls, v: str) -> str:
        if v not in ("cash", "qr"):
            raise ValueError("method must be 'cash' or 'qr'")
        return v

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be greater than zero")
        return v


class KhataSettlementData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    customer_id: str
    amount: Decimal
    method: str
    note: str | None
    actor_name: str
    actor_cred_id: str | None
    created_at: datetime
    created_at_bs: str


class KhataOrderEntry(BaseModel):
    """A khata order (debit side of the ledger). `total` is the server-computed
    final amount, matching what the customer was shown at bill time."""

    id: str
    type: str
    placed_at: datetime
    placed_at_bs: str
    total: Decimal
    line_count: int


class KhataHistoryResponse(BaseModel):
    """Full khata log for a customer: orders they racked up + settlements
    they've paid, plus a live balance snapshot."""

    balance: Decimal
    debits_total: Decimal
    credits_total: Decimal
    orders: list[KhataOrderEntry]
    settlements: list[KhataSettlementData]


class ExpenseData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    category: str
    amount: Decimal
    note: str | None
    spent_at_bs: str
    actor_name: str
    actor_cred_id: str | None
    created_at: datetime
    updated_at: datetime


class CreateExpenseRequest(BaseModel):
    category: str = "Other"
    amount: Decimal
    note: str | None = None
    spent_at_bs: str

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be greater than zero")
        return v


class UpdateExpenseRequest(BaseModel):
    category: str | None = None
    amount: Decimal | None = None
    note: str | None = None
    spent_at_bs: str | None = None
    clear_note: bool = False


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


class RestroTenantInfo(BaseModel):
    """Business identity exposed to the RMS staff app — mirrors the fields
    on the `tenants` row (registered under platform auth). RMS needs this to
    print PAN/VAT on receipts and to gate the VAT toggle in Settings."""

    id: str
    name: str
    pan: str | None
    is_vat_registered: bool
    business_email: str | None
    business_phone: str | None
    business_address: str | None


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


# ---------------------------------------------------------------------------
# Employees (branch-scoped staff directory, separate from login credentials)
# ---------------------------------------------------------------------------

class EmployeeData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    name: str
    designation: str
    phone: str
    email: str | None
    salary: Decimal
    shift: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateEmployeeRequest(BaseModel):
    name: str
    designation: str = "Waiter"
    phone: str = ""
    email: str | None = None
    salary: Decimal = Decimal("0")
    shift: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required")
        return v


class UpdateEmployeeRequest(BaseModel):
    name: str | None = None
    designation: str | None = None
    phone: str | None = None
    email: str | None = None
    salary: Decimal | None = None
    shift: str | None = None
    is_active: bool | None = None
    # PATCH semantics: an omitted key means "unchanged", NOT "clear". To
    # explicitly null out email/shift the caller sets the corresponding
    # clear_* flag.
    clear_email: bool = False
    clear_shift: bool = False

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name is required")
        return v


# ---------------------------------------------------------------------------
# Customers (khata / recurring customer directory)
# ---------------------------------------------------------------------------

class CustomerData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    name: str
    phone: str | None
    address: str | None
    notes: str | None
    is_active: bool
    # Sum of unsettled khata order totals for this customer. Populated by
    # the router when returning single-customer / list responses (defaults
    # to 0 for freshly-created rows).
    outstanding_balance: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime


class CreateCustomerRequest(BaseModel):
    name: str
    phone: str | None = None
    address: str | None = None
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Customer name is required")
        return v


class UpdateCustomerRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    clear_phone: bool = False
    clear_address: bool = False
    clear_notes: bool = False

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Customer name is required")
        return v
