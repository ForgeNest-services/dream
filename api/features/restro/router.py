from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, require_role, require_restro_staff
from utils.helpers import success_response, error_response
from utils.paging import parse_paging, build_meta
from features.restro.schemas import (
    CreateCredentialRequest,
    UpdateCredentialRequest,
    CredentialData,
    StaffLoginRequest,
    StaffLoginResponse,
    CreateCategoryRequest,
    UpdateCategoryRequest,
    CategoryData,
    CreateMenuItemRequest,
    UpdateMenuItemRequest,
    SetSoldOutRequest,
    MenuItemData,
    ZoneData,
    CreateZoneRequest,
    UpdateZoneRequest,
    TableData,
    CreateTableRequest,
    UpdateTableRequest,
    ReserveTableRequest,
    MergeTablesRequest,
    OrderData,
    CreateOrderRequest,
    AddOrderLineRequest,
    UpdateOrderLineRequest,
    VoidOrderLineRequest,
    SetKitchenStatusRequest,
    SetDiscountRequest,
    MarkPaidRequest,
    SetDeliveryStatusRequest,
    InventoryItemData,
    StockMovementData,
    CreateInventoryItemRequest,
    UpdateInventoryItemRequest,
    RestockRequest,
    AdjustStockRequest,
    EmployeeData,
    CreateEmployeeRequest,
    UpdateEmployeeRequest,
    CustomerData,
    CreateCustomerRequest,
    UpdateCustomerRequest,
    CreateKhataSettlementRequest,
    KhataSettlementData,
    KhataOrderEntry,
    KhataHistoryResponse,
    RestroTenantInfo,
)
from shared_models import Tenant
from features.restro.service import RestroCredentialService, RestroAuthService
from features.restro.category_service import CategoryService
from features.restro.menu_item_service import MenuItemService
from features.restro.zone_service import ZoneService
from features.restro.table_service import TableService
from features.restro.order_service import OrderService
from features.restro.inventory_service import InventoryService
from features.restro.employee_service import EmployeeService
from features.restro.customer_service import CustomerService
from features.restro.customer_repository import CustomerRepository
from features.restro.order_service import compute_order_total
from features.restro.khata_settlement_repository import KhataSettlementRepository
from features.restro.repository import RestroCredentialRepository


router = APIRouter(prefix="/restro", tags=["restro"])


def _assert_branch_scope(staff: dict, branch_id: str) -> None:
    """Managers/waiters/chefs can only touch their own branch. Owner spans all."""
    if staff["role"] == "owner":
        return
    if staff.get("branch_id") != branch_id:
        raise HTTPException(403, "Not allowed for this branch")


# ---------------------------------------------------------------------------
# Tenant info (read-only) — for the RMS Settings screen and bill receipts,
# which need PAN + VAT-registration status pulled from the tenant row.
# ---------------------------------------------------------------------------


@router.get("/tenant-info")
def get_tenant_info(
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    tenant = db.query(Tenant).filter(Tenant.id == staff["tenant_id"]).first()
    if not tenant:
        return error_response("TENANT_NOT_FOUND", "Business not found.", 404)
    return success_response(
        data=RestroTenantInfo(
            id=tenant.id,
            name=tenant.name,
            pan=tenant.pan,
            is_vat_registered=bool(tenant.is_vat_registered),
            business_email=tenant.business_email,
            business_phone=tenant.business_phone,
            business_address=tenant.business_address,
        ).model_dump(mode="json")
    )


# ---------------------------------------------------------------------------
# Staff-facing (public) - login from restro.dream.com
# ---------------------------------------------------------------------------

@router.post("/auth/login")
def staff_login(data: StaffLoginRequest, db: Session = Depends(get_db)):
    result = RestroAuthService.login(db, data.username, data.password)

    if not result["success"]:
        return error_response(
            "INVALID_CREDENTIALS",
            "Incorrect username or password.",
            401,
        )

    return success_response(
        data=StaffLoginResponse(
            token=result["token"],
            role=result["role"],
            tenant_id=result["tenant_id"],
            branch_id=result["branch_id"],
            expires_at=result["expires_at"],
        ).model_dump(mode="json"),
        message="Logged in",
    )


# ---------------------------------------------------------------------------
# Owner-facing (platform auth)
# ---------------------------------------------------------------------------

owner_dep = [Depends(require_tenant_user)]


@router.get("/credentials", dependencies=owner_dep)
def list_credentials(
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    creds = RestroCredentialService.list_for_tenant(db, user.tenant_id)
    return success_response(
        data=[CredentialData.model_validate(c).model_dump(mode="json") for c in creds]
    )


@router.post("/credentials", dependencies=owner_dep)
def create_credential(
    data: CreateCredentialRequest,
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = RestroCredentialService.create(
        db,
        tenant_id=user.tenant_id,
        created_by=user.id,
        role=data.role,
        username=data.username,
        password=data.password,
        branch_id=data.branch_id,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "BRANCH_NOT_FOUND":
            return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
        if code == "ROLE_ALREADY_HAS_CREDENTIAL":
            return error_response(
                "ROLE_ALREADY_HAS_CREDENTIAL",
                f"A credential for role '{data.role}' already exists for this branch.",
                409,
            )
        if code == "USERNAME_TAKEN":
            return error_response(
                "USERNAME_TAKEN",
                "This username is already in use. Pick another.",
                409,
            )
        return error_response("CREATION_FAILED", "Failed to create credential.", 500)

    return success_response(
        data=CredentialData.model_validate(result["credential"]).model_dump(mode="json"),
        message="Credential created",
        status_code=201,
    )


@router.patch("/credentials/{cred_id}", dependencies=owner_dep)
def update_credential(
    cred_id: str,
    data: UpdateCredentialRequest,
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = RestroCredentialService.update(
        db,
        tenant_id=user.tenant_id,
        cred_id=cred_id,
        username=data.username,
        password=data.password,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "CREDENTIAL_NOT_FOUND":
            return error_response("CREDENTIAL_NOT_FOUND", "Credential not found.", 404)
        if code == "USERNAME_TAKEN":
            return error_response("USERNAME_TAKEN", "This username is already in use.", 409)
        return error_response("UPDATE_FAILED", "Failed to update credential.", 500)

    return success_response(
        data=CredentialData.model_validate(result["credential"]).model_dump(mode="json"),
        message="Credential updated",
    )


@router.delete("/credentials/{cred_id}", dependencies=owner_dep)
def delete_credential(
    cred_id: str,
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = RestroCredentialService.delete(db, tenant_id=user.tenant_id, cred_id=cred_id)

    if not result["success"]:
        return error_response("CREDENTIAL_NOT_FOUND", "Credential not found.", 404)

    return success_response(data={"deleted": True}, message="Credential removed")


# ---------------------------------------------------------------------------
# Categories (staff-facing — managed from Zestro)
# ---------------------------------------------------------------------------

@router.get("/branches/{branch_id}/categories")
def list_categories(
    branch_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = CategoryService.list_for_branch(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
    return success_response(
        data=[CategoryData.model_validate(c).model_dump(mode="json") for c in result["categories"]]
    )


@router.post("/branches/{branch_id}/categories")
def create_category(
    branch_id: str,
    data: CreateCategoryRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can create categories")
    _assert_branch_scope(staff, branch_id)

    result = CategoryService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        name=data.name,
        display_order=data.display_order,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "BRANCH_NOT_FOUND":
            return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
        if code == "NAME_TAKEN":
            return error_response("NAME_TAKEN", "A category with this name already exists.", 409)
        return error_response("CREATION_FAILED", "Failed to create category.", 500)

    return success_response(
        data=CategoryData.model_validate(result["category"]).model_dump(mode="json"),
        message="Category created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/categories/{category_id}")
def update_category(
    branch_id: str,
    category_id: str,
    data: UpdateCategoryRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can edit categories")
    _assert_branch_scope(staff, branch_id)

    result = CategoryService.update(
        db,
        tenant_id=staff["tenant_id"],
        category_id=category_id,
        name=data.name,
        display_order=data.display_order,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "CATEGORY_NOT_FOUND":
            return error_response("CATEGORY_NOT_FOUND", "Category not found.", 404)
        if code == "NAME_TAKEN":
            return error_response("NAME_TAKEN", "A category with this name already exists.", 409)
        return error_response("UPDATE_FAILED", "Failed to update category.", 500)

    return success_response(
        data=CategoryData.model_validate(result["category"]).model_dump(mode="json"),
        message="Category updated",
    )


@router.delete("/branches/{branch_id}/categories/{category_id}")
def delete_category(
    branch_id: str,
    category_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete categories")
    _assert_branch_scope(staff, branch_id)

    result = CategoryService.delete(db, tenant_id=staff["tenant_id"], category_id=category_id)
    if not result["success"]:
        return error_response("CATEGORY_NOT_FOUND", "Category not found.", 404)
    return success_response(data={"deleted": True}, message="Category removed")


# ---------------------------------------------------------------------------
# Menu items (staff-facing — managed from Zestro)
# ---------------------------------------------------------------------------

_MENU_ITEM_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "CATEGORY_NOT_FOUND": ("CATEGORY_NOT_FOUND", "Category not found for this branch.", 404),
    "ITEM_NOT_FOUND": ("ITEM_NOT_FOUND", "Menu item not found.", 404),
    "NAME_TAKEN": ("NAME_TAKEN", "A menu item with this name already exists.", 409),
    "PRICE_REQUIRED": ("PRICE_REQUIRED", "Price is required when the item has no variants.", 422),
    "PRICE_NOT_ALLOWED_WITH_VARIANTS": (
        "PRICE_NOT_ALLOWED_WITH_VARIANTS",
        "Remove the flat price — items with variants price each variant instead.",
        422,
    ),
    "VARIANTS_REQUIRED": ("VARIANTS_REQUIRED", "Add at least one variant.", 422),
    "VARIANTS_NOT_ALLOWED": (
        "VARIANTS_NOT_ALLOWED",
        "Remove variants or enable 'Has Variants' first.",
        422,
    ),
    "VARIANT_NAME_REQUIRED": ("VARIANT_NAME_REQUIRED", "Every variant needs a name.", 422),
}


def _menu_item_error(code: str):
    mapped = _MENU_ITEM_ERROR_MAP.get(code, ("CREATION_FAILED", "Failed to save menu item.", 500))
    return error_response(*mapped)


@router.get("/branches/{branch_id}/menu-items")
def list_menu_items(
    branch_id: str,
    category_id: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = MenuItemService.list_for_branch(db, staff["tenant_id"], branch_id, category_id)
    if not result["success"]:
        return _menu_item_error(result["error_code"])
    return success_response(
        data=[MenuItemData.model_validate(i).model_dump(mode="json") for i in result["items"]]
    )


@router.post("/branches/{branch_id}/menu-items")
def create_menu_item(
    branch_id: str,
    data: CreateMenuItemRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can create menu items")
    _assert_branch_scope(staff, branch_id)

    result = MenuItemService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        category_id=data.category_id,
        name=data.name,
        has_variants=data.has_variants,
        price=data.price,
        image_url=data.image_url,
        variants=[v.model_dump() for v in data.variants],
    )

    if not result["success"]:
        return _menu_item_error(result["error_code"])

    return success_response(
        data=MenuItemData.model_validate(result["item"]).model_dump(mode="json"),
        message="Menu item created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/menu-items/{item_id}")
def update_menu_item(
    branch_id: str,
    item_id: str,
    data: UpdateMenuItemRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can edit menu items")
    _assert_branch_scope(staff, branch_id)

    result = MenuItemService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        item_id=item_id,
        category_id=data.category_id,
        name=data.name,
        has_variants=data.has_variants,
        price=data.price,
        price_explicitly_null=data.clear_price,
        image_url=data.image_url,
        variants=[v.model_dump() for v in data.variants] if data.variants is not None else None,
    )

    if not result["success"]:
        return _menu_item_error(result["error_code"])

    return success_response(
        data=MenuItemData.model_validate(result["item"]).model_dump(mode="json"),
        message="Menu item updated",
    )


@router.patch("/branches/{branch_id}/menu-items/{item_id}/sold-out")
def set_menu_item_sold_out(
    branch_id: str,
    item_id: str,
    data: SetSoldOutRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    # Any staff role can flip sold-out — it's an operational floor decision,
    # not a menu-editing one.
    _assert_branch_scope(staff, branch_id)

    result = MenuItemService.set_sold_out(
        db, tenant_id=staff["tenant_id"], branch_id=branch_id, item_id=item_id, sold_out=data.sold_out
    )
    if not result["success"]:
        return _menu_item_error(result["error_code"])

    return success_response(
        data=MenuItemData.model_validate(result["item"]).model_dump(mode="json"),
        message="Sold-out status updated",
    )


@router.delete("/branches/{branch_id}/menu-items/{item_id}")
def delete_menu_item(
    branch_id: str,
    item_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete menu items")
    _assert_branch_scope(staff, branch_id)

    result = MenuItemService.delete(db, tenant_id=staff["tenant_id"], branch_id=branch_id, item_id=item_id)
    if not result["success"]:
        return _menu_item_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Menu item removed")


# ---------------------------------------------------------------------------
# Zones (floors / sections) — staff-facing, edit gated to owner/manager
# ---------------------------------------------------------------------------

_ZONE_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "ZONE_NOT_FOUND": ("ZONE_NOT_FOUND", "Zone not found.", 404),
    "NAME_TAKEN": ("NAME_TAKEN", "A zone with this name already exists.", 409),
    "ZONE_HAS_TABLES": (
        "ZONE_HAS_TABLES",
        "This zone still has tables. Move or remove them first.",
        409,
    ),
}


def _zone_error(code: str):
    mapped = _ZONE_ERROR_MAP.get(code, ("CREATION_FAILED", "Failed to save zone.", 500))
    return error_response(*mapped)


@router.get("/branches/{branch_id}/zones")
def list_zones(
    branch_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = ZoneService.list_for_branch(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return _zone_error(result["error_code"])
    return success_response(
        data=[ZoneData.model_validate(z).model_dump(mode="json") for z in result["zones"]]
    )


@router.post("/branches/{branch_id}/zones")
def create_zone(
    branch_id: str,
    data: CreateZoneRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can create zones")
    _assert_branch_scope(staff, branch_id)
    result = ZoneService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        name=data.name,
        display_order=data.display_order,
    )
    if not result["success"]:
        return _zone_error(result["error_code"])
    return success_response(
        data=ZoneData.model_validate(result["zone"]).model_dump(mode="json"),
        message="Zone created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/zones/{zone_id}")
def update_zone(
    branch_id: str,
    zone_id: str,
    data: UpdateZoneRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can edit zones")
    _assert_branch_scope(staff, branch_id)
    result = ZoneService.update(
        db,
        tenant_id=staff["tenant_id"],
        zone_id=zone_id,
        name=data.name,
        display_order=data.display_order,
    )
    if not result["success"]:
        return _zone_error(result["error_code"])
    return success_response(
        data=ZoneData.model_validate(result["zone"]).model_dump(mode="json"),
        message="Zone updated",
    )


@router.delete("/branches/{branch_id}/zones/{zone_id}")
def delete_zone(
    branch_id: str,
    zone_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete zones")
    _assert_branch_scope(staff, branch_id)
    result = ZoneService.delete(db, tenant_id=staff["tenant_id"], zone_id=zone_id)
    if not result["success"]:
        return _zone_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Zone removed")


# ---------------------------------------------------------------------------
# Tables (physical seating) — CRUD gated to owner/manager, floor ops open to all
# ---------------------------------------------------------------------------

_TABLE_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "ZONE_NOT_FOUND": ("ZONE_NOT_FOUND", "Zone not found in this branch.", 404),
    "TABLE_NOT_FOUND": ("TABLE_NOT_FOUND", "Table not found.", 404),
    "LABEL_TAKEN": ("LABEL_TAKEN", "A table with this label already exists in the zone.", 409),
    "INVALID_STATUS": ("INVALID_STATUS", "Status must be empty, occupied or reserved.", 422),
    "TABLE_NOT_EMPTY": (
        "TABLE_NOT_EMPTY",
        "This table is currently occupied or reserved. Clear it first.",
        409,
    ),
    "TABLE_OCCUPIED": (
        "TABLE_OCCUPIED",
        "This table is occupied — can't book a reservation on top of a live order.",
        409,
    ),
    "NO_RESERVATION": ("NO_RESERVATION", "There is no reservation on this table.", 409),
    "GUEST_NAME_REQUIRED": ("GUEST_NAME_REQUIRED", "Guest name is required.", 422),
    "INVALID_PARTY_SIZE": ("INVALID_PARTY_SIZE", "Party size must be at least 1.", 422),
    "MERGE_NEEDS_TWO": ("MERGE_NEEDS_TWO", "Select at least two tables to merge.", 422),
    "MERGE_CROSS_ZONE": (
        "MERGE_CROSS_ZONE",
        "All merged tables must be in the same zone.",
        409,
    ),
    "TABLE_ALREADY_MERGED": (
        "TABLE_ALREADY_MERGED",
        "One of these tables is already merged. Unmerge it first.",
        409,
    ),
    "NOT_MERGED": ("NOT_MERGED", "This table isn't part of a merge group.", 409),
}


def _table_error(code: str):
    mapped = _TABLE_ERROR_MAP.get(code, ("CREATION_FAILED", "Failed to save table.", 500))
    return error_response(*mapped)


@router.get("/branches/{branch_id}/tables")
def list_tables(
    branch_id: str,
    zone_id: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = TableService.list_for_branch(db, staff["tenant_id"], branch_id, zone_id)
    if not result["success"]:
        return _table_error(result["error_code"])
    return success_response(
        data=[TableData.model_validate(t).model_dump(mode="json") for t in result["tables"]]
    )


@router.post("/branches/{branch_id}/tables")
def create_table(
    branch_id: str,
    data: CreateTableRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can create tables")
    _assert_branch_scope(staff, branch_id)
    result = TableService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        zone_id=data.zone_id,
        label=data.label,
    )
    if not result["success"]:
        return _table_error(result["error_code"])
    return success_response(
        data=TableData.model_validate(result["table"]).model_dump(mode="json"),
        message="Table created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/tables/{table_id}")
def update_table(
    branch_id: str,
    table_id: str,
    data: UpdateTableRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can edit tables")
    _assert_branch_scope(staff, branch_id)
    result = TableService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        table_id=table_id,
        label=data.label,
        zone_id=data.zone_id,
        status=data.status,
    )
    if not result["success"]:
        return _table_error(result["error_code"])
    return success_response(
        data=TableData.model_validate(result["table"]).model_dump(mode="json"),
        message="Table updated",
    )


@router.delete("/branches/{branch_id}/tables/{table_id}")
def delete_table(
    branch_id: str,
    table_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete tables")
    _assert_branch_scope(staff, branch_id)
    result = TableService.delete(db, tenant_id=staff["tenant_id"], branch_id=branch_id, table_id=table_id)
    if not result["success"]:
        return _table_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Table removed")


@router.post("/branches/{branch_id}/tables/{table_id}/reserve")
def reserve_table(
    branch_id: str,
    table_id: str,
    data: ReserveTableRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    # Any staff role — reserving a table is a floor operation.
    _assert_branch_scope(staff, branch_id)
    result = TableService.reserve(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        table_id=table_id,
        guest_name=data.guest_name,
        phone=data.phone,
        date_val=data.date,
        time=data.time,
        party_size=data.party_size,
    )
    if not result["success"]:
        return _table_error(result["error_code"])
    return success_response(
        data=TableData.model_validate(result["table"]).model_dump(mode="json"),
        message="Reservation set",
    )


@router.delete("/branches/{branch_id}/tables/{table_id}/reservation")
def clear_table_reservation(
    branch_id: str,
    table_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = TableService.clear_reservation(
        db, tenant_id=staff["tenant_id"], branch_id=branch_id, table_id=table_id
    )
    if not result["success"]:
        return _table_error(result["error_code"])
    return success_response(
        data=TableData.model_validate(result["table"]).model_dump(mode="json"),
        message="Reservation cleared",
    )


@router.post("/branches/{branch_id}/tables/merge")
def merge_tables(
    branch_id: str,
    data: MergeTablesRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = TableService.merge(
        db, tenant_id=staff["tenant_id"], branch_id=branch_id, table_ids=data.table_ids
    )
    if not result["success"]:
        return _table_error(result["error_code"])
    return success_response(
        data=[TableData.model_validate(t).model_dump(mode="json") for t in result["tables"]],
        message="Tables merged",
    )


@router.post("/branches/{branch_id}/tables/{table_id}/unmerge")
def unmerge_table(
    branch_id: str,
    table_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = TableService.unmerge(
        db, tenant_id=staff["tenant_id"], branch_id=branch_id, table_id=table_id
    )
    if not result["success"]:
        return _table_error(result["error_code"])
    return success_response(
        data=[TableData.model_validate(t).model_dump(mode="json") for t in result["tables"]],
        message="Tables unmerged",
    )


# ---------------------------------------------------------------------------
# Orders (staff-facing — every role can operate on orders as floor ops)
# ---------------------------------------------------------------------------

_ORDER_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "TABLE_NOT_FOUND": ("TABLE_NOT_FOUND", "Table not found in this branch.", 404),
    "ORDER_NOT_FOUND": ("ORDER_NOT_FOUND", "Order not found.", 404),
    "CUSTOMER_NOT_FOUND": ("CUSTOMER_NOT_FOUND", "Customer not found.", 404),
    "CUSTOMER_REQUIRED": (
        "CUSTOMER_REQUIRED",
        "Delivery orders need a customer — pick one or add a new one.",
        422,
    ),
    "CUSTOMER_REQUIRED_FOR_KHATA": (
        "CUSTOMER_REQUIRED_FOR_KHATA",
        "Khata payments need a customer — pick one or add a new one.",
        422,
    ),
    "LINE_NOT_FOUND": ("LINE_NOT_FOUND", "Order line not found.", 404),
    "MENU_ITEM_NOT_FOUND": (
        "MENU_ITEM_NOT_FOUND",
        "Menu item not found for this branch.",
        404,
    ),
    "VARIANT_NOT_FOUND": (
        "VARIANT_NOT_FOUND",
        "That variant no longer exists on this menu item.",
        404,
    ),
    "VARIANT_REQUIRED": (
        "VARIANT_REQUIRED",
        "This item has variants — pick one.",
        422,
    ),
    "ITEM_SOLD_OUT": ("ITEM_SOLD_OUT", "This item is sold out right now.", 409),
    "INVALID_TYPE": ("INVALID_TYPE", "type must be 'dine-in' or 'delivery'.", 422),
    "TABLE_REQUIRED": ("TABLE_REQUIRED", "table_id is required for a dine-in order.", 422),
    "TABLE_ALREADY_HAS_DRAFT": (
        "TABLE_ALREADY_HAS_DRAFT",
        "This table already has an open bill. Open the existing order instead.",
        409,
    ),
    "ORDER_NOT_EDITABLE": (
        "ORDER_NOT_EDITABLE",
        "This order is closed — it can't be edited.",
        409,
    ),
    "INVALID_QTY": ("INVALID_QTY", "Quantity must be at least 1.", 422),
    "INVALID_PRICE": ("INVALID_PRICE", "Price must be zero or positive.", 422),
    "NAME_AND_PRICE_REQUIRED": (
        "NAME_AND_PRICE_REQUIRED",
        "Off-menu lines need both a name and a price.",
        422,
    ),
    "CANNOT_DELETE_SENT_LINE": (
        "CANNOT_DELETE_SENT_LINE",
        "This line has already been sent to the kitchen — void it with a reason instead.",
        409,
    ),
    "INVALID_KITCHEN_STATUS": (
        "INVALID_KITCHEN_STATUS",
        "Kitchen status must be one of: new, cooking, ready, served.",
        422,
    ),
    "INVALID_DISCOUNT_TYPE": (
        "INVALID_DISCOUNT_TYPE",
        "Discount type must be 'percent' or 'flat'.",
        422,
    ),
    "INVALID_DISCOUNT_VALUE": (
        "INVALID_DISCOUNT_VALUE",
        "Discount value can't be negative.",
        422,
    ),
    "INVALID_PAYMENT_METHOD": (
        "INVALID_PAYMENT_METHOD",
        "Payment method must be one of: cash, qr, khata.",
        422,
    ),
    "INVALID_SETTLEMENT_METHOD": (
        "INVALID_SETTLEMENT_METHOD",
        "Settlement method must be 'cash' or 'qr'.",
        422,
    ),
    "NO_BALANCE_TO_SETTLE": (
        "NO_BALANCE_TO_SETTLE",
        "This customer has no outstanding khata balance.",
        409,
    ),
    "INVALID_AMOUNT": (
        "INVALID_AMOUNT",
        "Amount must be greater than zero.",
        422,
    ),
    "AMOUNT_EXCEEDS_BALANCE": (
        "AMOUNT_EXCEEDS_BALANCE",
        "Payment can't be more than the outstanding balance.",
        422,
    ),
    "INVALID_DELIVERY_STATUS": (
        "INVALID_DELIVERY_STATUS",
        "Delivery status must be one of: pending, out, delivered.",
        422,
    ),
    "NOT_A_DELIVERY_ORDER": (
        "NOT_A_DELIVERY_ORDER",
        "This order isn't a delivery order.",
        409,
    ),
    "LINE_ADD_FAILED": ("LINE_ADD_FAILED", "Failed to add line.", 500),
    "CREATION_FAILED": ("CREATION_FAILED", "Failed to create order.", 500),
}


def _order_error(code: str):
    mapped = _ORDER_ERROR_MAP.get(code, ("SERVER_ERROR", "Something went wrong.", 500))
    return error_response(*mapped)


def _order_payload(order) -> dict:
    """Serialize an Order (with lines relationship loaded) to the response
    shape. Kept centralized so every endpoint returns identical structure."""
    return OrderData.model_validate(order).model_dump(mode="json")


@router.get("/branches/{branch_id}/orders")
def list_orders(
    branch_id: str,
    status: str | None = None,
    type: str | None = None,
    kitchen_status: str | None = None,
    table_id: str | None = None,
    limit: int | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Simple non-paginated fetch — used by the store to keep a live cache
    of recent orders (kitchen board, delivery view, dashboard). For the
    historical bills list use /orders/paginated instead."""
    _assert_branch_scope(staff, branch_id)
    result = OrderService.list_for_branch(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        status=status,
        type=type,
        kitchen_status=kitchen_status,
        table_id=table_id,
        limit=limit,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    return success_response(data=[_order_payload(o) for o in result["orders"]])


@router.get("/branches/{branch_id}/orders/paginated")
def list_orders_paginated(
    branch_id: str,
    status: str | None = None,
    type: str | None = None,
    kitchen_status: str | None = None,
    table_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    q: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Paginated bills-history endpoint. `bs_from` / `bs_to` accept BS dates
    as "YYYY-MM-DD" strings and hit the (branch_id, placed_at_bs) index."""
    _assert_branch_scope(staff, branch_id)
    paging = parse_paging(page, per_page)
    result = OrderService.list_paginated(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        status=status,
        type=type,
        kitchen_status=kitchen_status,
        table_id=table_id,
        bs_from=bs_from,
        bs_to=bs_to,
        search=q,
        offset=paging["offset"],
        limit=paging["limit"],
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    return success_response(
        data=[_order_payload(o) for o in result["orders"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.get("/branches/{branch_id}/orders/by-table/{table_id}")
def get_draft_order_for_table(
    branch_id: str,
    table_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.get_draft_for_table(
        db, tenant_id=staff["tenant_id"], branch_id=branch_id, table_id=table_id
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    # order may be None (no draft yet) — return null explicitly so the client
    # can decide whether to open one.
    return success_response(
        data=_order_payload(result["order"]) if result["order"] else None
    )


@router.get("/branches/{branch_id}/orders/{order_id}")
def get_order(
    branch_id: str,
    order_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.get(db, staff["tenant_id"], branch_id, order_id)
    if not result["success"]:
        return _order_error(result["error_code"])
    return success_response(data=_order_payload(result["order"]))


@router.post("/branches/{branch_id}/orders")
def create_order(
    branch_id: str,
    data: CreateOrderRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    # Snapshot the waiter's login username so the receipt can name them even
    # if the credential is later renamed or deleted. The JWT doesn't carry
    # username (only cred_id + role) — look it up here.
    cred_id = staff.get("cred_id")
    waiter_name = staff.get("role") or "staff"
    if cred_id:
        cred = RestroCredentialRepository.get_by_id(db, staff["tenant_id"], cred_id)
        if cred:
            waiter_name = cred.username
    result = OrderService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        type=data.type,
        table_id=data.table_id,
        customer_id=data.customer_id,
        waiter_name=waiter_name,
        waiter_cred_id=cred_id,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    return success_response(
        data=_order_payload(result["order"]), message="Order created", status_code=201
    )


@router.post("/branches/{branch_id}/orders/{order_id}/lines")
def add_order_line(
    branch_id: str,
    order_id: str,
    data: AddOrderLineRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.add_line(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        menu_item_id=data.menu_item_id,
        variant_name=data.variant_name,
        name=data.name,
        price=data.price,
        qty=data.qty,
        note=data.note,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    return success_response(
        data=_order_payload(result["order"]), message="Item added"
    )


@router.patch("/branches/{branch_id}/orders/{order_id}/lines/{line_id}")
def update_order_line(
    branch_id: str,
    order_id: str,
    line_id: str,
    data: UpdateOrderLineRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.update_line(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        line_id=line_id,
        qty=data.qty,
        note=data.note,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    # Return the whole order so the client refreshes the running total in one round-trip.
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Line updated")


@router.post("/branches/{branch_id}/orders/{order_id}/lines/{line_id}/void")
def void_order_line(
    branch_id: str,
    order_id: str,
    line_id: str,
    data: VoidOrderLineRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.void_line(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        line_id=line_id,
        reason=data.reason,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Line voided")


@router.delete("/branches/{branch_id}/orders/{order_id}/lines/{line_id}")
def delete_order_line(
    branch_id: str,
    order_id: str,
    line_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.delete_line(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        line_id=line_id,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Line removed")


@router.post("/branches/{branch_id}/orders/{order_id}/send-to-kitchen")
def send_order_to_kitchen(
    branch_id: str,
    order_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.send_to_kitchen(
        db, tenant_id=staff["tenant_id"], branch_id=branch_id, order_id=order_id
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(
        data=_order_payload(order),
        message=f"Sent {result['marked']} line(s) to kitchen",
    )


@router.patch("/branches/{branch_id}/orders/{order_id}/kitchen-status")
def set_kitchen_status(
    branch_id: str,
    order_id: str,
    data: SetKitchenStatusRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.set_kitchen_status(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        kitchen_status=data.kitchen_status,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Kitchen status updated")


@router.patch("/branches/{branch_id}/orders/{order_id}/discount")
def set_order_discount(
    branch_id: str,
    order_id: str,
    data: SetDiscountRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.set_discount(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Discount updated")


@router.post("/branches/{branch_id}/orders/{order_id}/mark-paid")
def mark_order_paid(
    branch_id: str,
    order_id: str,
    data: MarkPaidRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.mark_paid(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        payment_method=data.payment_method,
        customer_id=data.customer_id,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Marked as paid")


@router.post("/branches/{branch_id}/orders/{order_id}/cancel")
def cancel_order(
    branch_id: str,
    order_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.cancel(
        db, tenant_id=staff["tenant_id"], branch_id=branch_id, order_id=order_id
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Order cancelled")


@router.patch("/branches/{branch_id}/orders/{order_id}/delivery-status")
def set_order_delivery_status(
    branch_id: str,
    order_id: str,
    data: SetDeliveryStatusRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    # Delivery is an owner/manager workflow — waiters and chefs don't get
    # nav access to the Delivery page in the UI, but gate it here too so a
    # rogue token can't backdoor it.
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can update delivery status")
    _assert_branch_scope(staff, branch_id)
    result = OrderService.set_delivery_status(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        delivery_status=data.delivery_status,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Delivery status updated")


# ---------------------------------------------------------------------------
# Inventory (staff-facing — every role can restock/adjust; CRUD gated to
# owner/manager)
# ---------------------------------------------------------------------------

_INVENTORY_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "ITEM_NOT_FOUND": ("ITEM_NOT_FOUND", "Inventory item not found.", 404),
    "NAME_TAKEN": ("NAME_TAKEN", "An inventory item with this name already exists.", 409),
    "INVALID_UNIT": ("INVALID_UNIT", "Unit must be kg, liter, piece or packet.", 422),
    "INVALID_THRESHOLD": ("INVALID_THRESHOLD", "Threshold can't be negative.", 422),
    "INVALID_STOCK": ("INVALID_STOCK", "Opening stock can't be negative.", 422),
    "INVALID_QTY": ("INVALID_QTY", "Quantity must be greater than zero.", 422),
    "INVALID_COST": ("INVALID_COST", "Cost can't be negative.", 422),
    "INVALID_DELTA": ("INVALID_DELTA", "Adjustment can't be zero.", 422),
    "REASON_REQUIRED": ("REASON_REQUIRED", "Reason is required for an adjustment.", 422),
}


def _inventory_error(code: str):
    mapped = _INVENTORY_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to save inventory item.", 500))
    return error_response(*mapped)


def _actor_from_staff(db: Session, staff: dict) -> tuple[str, str | None]:
    """Snapshot the acting user's username (like `waiter_name` on orders) so
    the movement log survives credential renames or deletions."""
    cred_id = staff.get("cred_id")
    name = staff.get("role") or "staff"
    if cred_id:
        cred = RestroCredentialRepository.get_by_id(db, staff["tenant_id"], cred_id)
        if cred:
            name = cred.username
    return name, cred_id


@router.get("/branches/{branch_id}/inventory")
def list_inventory(
    branch_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = InventoryService.list_for_branch(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return _inventory_error(result["error_code"])
    return success_response(
        data=[InventoryItemData.model_validate(i).model_dump(mode="json") for i in result["items"]]
    )


@router.post("/branches/{branch_id}/inventory")
def create_inventory_item(
    branch_id: str,
    data: CreateInventoryItemRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can create inventory items")
    _assert_branch_scope(staff, branch_id)
    actor_name, cred_id = _actor_from_staff(db, staff)
    result = InventoryService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        name=data.name,
        category=data.category,
        unit=data.unit,
        threshold=data.threshold,
        stock=data.stock,
        actor_name=actor_name,
        actor_cred_id=cred_id,
    )
    if not result["success"]:
        return _inventory_error(result["error_code"])
    return success_response(
        data=InventoryItemData.model_validate(result["item"]).model_dump(mode="json"),
        message="Inventory item created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/inventory/{item_id}")
def update_inventory_item(
    branch_id: str,
    item_id: str,
    data: UpdateInventoryItemRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can edit inventory items")
    _assert_branch_scope(staff, branch_id)
    result = InventoryService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        item_id=item_id,
        name=data.name,
        category=data.category,
        unit=data.unit,
        threshold=data.threshold,
    )
    if not result["success"]:
        return _inventory_error(result["error_code"])
    return success_response(
        data=InventoryItemData.model_validate(result["item"]).model_dump(mode="json"),
        message="Inventory item updated",
    )


@router.delete("/branches/{branch_id}/inventory/{item_id}")
def delete_inventory_item(
    branch_id: str,
    item_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete inventory items")
    _assert_branch_scope(staff, branch_id)
    result = InventoryService.delete(db, staff["tenant_id"], branch_id, item_id)
    if not result["success"]:
        return _inventory_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Inventory item removed")


@router.post("/branches/{branch_id}/inventory/{item_id}/restock")
def restock_inventory_item(
    branch_id: str,
    item_id: str,
    data: RestockRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    actor_name, cred_id = _actor_from_staff(db, staff)
    result = InventoryService.restock(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        item_id=item_id,
        qty=data.qty,
        cost=data.cost,
        note=data.note,
        actor_name=actor_name,
        actor_cred_id=cred_id,
    )
    if not result["success"]:
        return _inventory_error(result["error_code"])
    return success_response(
        data={
            "item": InventoryItemData.model_validate(result["item"]).model_dump(mode="json"),
            "movement": StockMovementData.model_validate(result["movement"]).model_dump(mode="json"),
        },
        message="Restock recorded",
    )


@router.post("/branches/{branch_id}/inventory/{item_id}/adjust")
def adjust_inventory_item(
    branch_id: str,
    item_id: str,
    data: AdjustStockRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    actor_name, cred_id = _actor_from_staff(db, staff)
    result = InventoryService.adjust(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        item_id=item_id,
        delta=data.delta,
        reason=data.reason,
        note=data.note,
        actor_name=actor_name,
        actor_cred_id=cred_id,
    )
    if not result["success"]:
        return _inventory_error(result["error_code"])
    return success_response(
        data={
            "item": InventoryItemData.model_validate(result["item"]).model_dump(mode="json"),
            "movement": StockMovementData.model_validate(result["movement"]).model_dump(mode="json"),
        },
        message="Adjustment recorded",
    )


@router.get("/branches/{branch_id}/inventory/{item_id}/movements")
def list_inventory_movements(
    branch_id: str,
    item_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = InventoryService.list_movements(
        db, staff["tenant_id"], branch_id, item_id
    )
    if not result["success"]:
        return _inventory_error(result["error_code"])
    return success_response(
        data=[
            StockMovementData.model_validate(m).model_dump(mode="json")
            for m in result["movements"]
        ]
    )


# ---------------------------------------------------------------------------
# Employees (branch-scoped staff directory — Owner/Manager only, all mutations)
# ---------------------------------------------------------------------------

_EMPLOYEE_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "EMPLOYEE_NOT_FOUND": ("EMPLOYEE_NOT_FOUND", "Employee not found.", 404),
    "INVALID_SALARY": ("INVALID_SALARY", "Salary can't be negative.", 422),
}


def _employee_error(code: str):
    mapped = _EMPLOYEE_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to save employee.", 500))
    return error_response(*mapped)


@router.get("/branches/{branch_id}/employees")
def list_employees(
    branch_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    # Any staff role can READ — waiters may want to see who's on shift. Only
    # owner/manager can create/edit/delete below.
    _assert_branch_scope(staff, branch_id)
    result = EmployeeService.list_for_branch(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return _employee_error(result["error_code"])
    return success_response(
        data=[EmployeeData.model_validate(e).model_dump(mode="json") for e in result["employees"]]
    )


@router.post("/branches/{branch_id}/employees")
def create_employee(
    branch_id: str,
    data: CreateEmployeeRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can add employees")
    _assert_branch_scope(staff, branch_id)
    result = EmployeeService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        name=data.name,
        designation=data.designation,
        phone=data.phone,
        email=data.email,
        salary=data.salary,
        shift=data.shift,
    )
    if not result["success"]:
        return _employee_error(result["error_code"])
    return success_response(
        data=EmployeeData.model_validate(result["employee"]).model_dump(mode="json"),
        message="Employee added",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/employees/{employee_id}")
def update_employee(
    branch_id: str,
    employee_id: str,
    data: UpdateEmployeeRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can edit employees")
    _assert_branch_scope(staff, branch_id)
    result = EmployeeService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        employee_id=employee_id,
        name=data.name,
        designation=data.designation,
        phone=data.phone,
        email=data.email,
        salary=data.salary,
        shift=data.shift,
        is_active=data.is_active,
        clear_email=data.clear_email,
        clear_shift=data.clear_shift,
    )
    if not result["success"]:
        return _employee_error(result["error_code"])
    return success_response(
        data=EmployeeData.model_validate(result["employee"]).model_dump(mode="json"),
        message="Employee updated",
    )


@router.delete("/branches/{branch_id}/employees/{employee_id}")
def delete_employee(
    branch_id: str,
    employee_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete employees")
    _assert_branch_scope(staff, branch_id)
    result = EmployeeService.delete(db, staff["tenant_id"], branch_id, employee_id)
    if not result["success"]:
        return _employee_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Employee removed")


# ---------------------------------------------------------------------------
# Customers (khata / recurring customer directory)
# Waiters CAN create + read (they need to pick a customer during payment).
# Only owner/manager can edit + delete.
# ---------------------------------------------------------------------------

_CUSTOMER_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "CUSTOMER_NOT_FOUND": ("CUSTOMER_NOT_FOUND", "Customer not found.", 404),
    "PHONE_TAKEN": (
        "PHONE_TAKEN",
        "A customer with this phone number already exists in this branch.",
        409,
    ),
}


def _customer_error(code: str):
    mapped = _CUSTOMER_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to save customer.", 500))
    return error_response(*mapped)


def _customer_payload(db: Session, tenant_id: str, customer) -> dict:
    """Serialize a customer with computed outstanding_balance. Kept in the
    router so the service layer stays balance-computation-agnostic."""
    payload = CustomerData.model_validate(customer).model_dump(mode="json")
    payload["outstanding_balance"] = str(
        OrderService.outstanding_balance(db, tenant_id, customer.id)
    )
    return payload


@router.get("/branches/{branch_id}/customers")
def list_customers(
    branch_id: str,
    q: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = CustomerService.list_for_branch(db, staff["tenant_id"], branch_id, q)
    if not result["success"]:
        return _customer_error(result["error_code"])
    # N+1 for now — each customer runs a balance query. Fine for MVP scale
    # (<100 customers/branch). If it becomes hot, replace with a single
    # aggregate JOIN query in the repo.
    return success_response(
        data=[_customer_payload(db, staff["tenant_id"], c) for c in result["customers"]]
    )


@router.post("/branches/{branch_id}/customers")
def create_customer(
    branch_id: str,
    data: CreateCustomerRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    # Any staff (incl. waiter) can create — they may need to add a fresh
    # customer inline while closing an order as khata.
    _assert_branch_scope(staff, branch_id)
    result = CustomerService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        name=data.name,
        phone=data.phone,
        address=data.address,
        notes=data.notes,
    )
    if not result["success"]:
        # Return the existing customer alongside the error so the client can
        # offer "use existing" instead of forcing a retry with a new phone.
        if result["error_code"] == "PHONE_TAKEN" and result.get("existing_customer"):
            existing = CustomerData.model_validate(result["existing_customer"]).model_dump(mode="json")
            return error_response(
                "PHONE_TAKEN",
                "A customer with this phone number already exists in this branch.",
                409,
                details={"existing_customer": existing},
            )
        return _customer_error(result["error_code"])
    return success_response(
        data=_customer_payload(db, staff["tenant_id"], result["customer"]),
        message="Customer added",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/customers/{customer_id}")
def update_customer(
    branch_id: str,
    customer_id: str,
    data: UpdateCustomerRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can edit customers")
    _assert_branch_scope(staff, branch_id)
    result = CustomerService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        customer_id=customer_id,
        name=data.name,
        phone=data.phone,
        address=data.address,
        notes=data.notes,
        is_active=data.is_active,
        clear_phone=data.clear_phone,
        clear_address=data.clear_address,
        clear_notes=data.clear_notes,
    )
    if not result["success"]:
        return _customer_error(result["error_code"])
    return success_response(
        data=_customer_payload(db, staff["tenant_id"], result["customer"]),
        message="Customer updated",
    )


@router.delete("/branches/{branch_id}/customers/{customer_id}")
def delete_customer(
    branch_id: str,
    customer_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete customers")
    _assert_branch_scope(staff, branch_id)
    result = CustomerService.delete(db, staff["tenant_id"], branch_id, customer_id)
    if not result["success"]:
        return _customer_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Customer removed")


@router.get("/branches/{branch_id}/customers/{customer_id}/khata-history")
def khata_history(
    branch_id: str,
    customer_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Full khata log for a customer: every khata order (debits) + every
    settlement (credits) + a live balance snapshot. Any staff can read.

    Orders and settlements are returned as separate arrays newest-first —
    the client is responsible for interleaving them into a timeline if it
    wants that presentation."""
    _assert_branch_scope(staff, branch_id)
    tenant_id = staff["tenant_id"]
    customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
    if not customer or customer.branch_id != branch_id or not customer.is_active:
        return error_response("CUSTOMER_NOT_FOUND", "Customer not found.", 404)

    orders = CustomerRepository.list_khata_orders(db, tenant_id, customer_id)
    settlements = KhataSettlementRepository.list_for_customer(db, tenant_id, customer_id)
    order_entries = [
        KhataOrderEntry(
            id=o.id,
            type=o.type,
            placed_at=o.placed_at,
            placed_at_bs=o.placed_at_bs,
            total=compute_order_total(o),
            line_count=sum(1 for l in o.lines if not l.is_voided),
        )
        for o in orders
    ]
    debits_total = sum((e.total for e in order_entries), Decimal("0"))
    credits_total = KhataSettlementRepository.total_for_customer(db, tenant_id, customer_id)
    balance = max(Decimal("0"), debits_total - credits_total)
    payload = KhataHistoryResponse(
        balance=balance,
        debits_total=debits_total,
        credits_total=credits_total,
        orders=order_entries,
        settlements=[KhataSettlementData.model_validate(s) for s in settlements],
    )
    return success_response(data=payload.model_dump(mode="json"))


@router.post("/branches/{branch_id}/customers/{customer_id}/khata-settlements")
def create_khata_settlement(
    branch_id: str,
    customer_id: str,
    data: CreateKhataSettlementRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Record a partial or full payment against a customer's khata balance.
    Owner/Manager only — this is the cash-drawer moment."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can accept khata settlements")
    _assert_branch_scope(staff, branch_id)
    actor_name, cred_id = _actor_from_staff(db, staff)
    result = OrderService.record_khata_settlement(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        customer_id=customer_id,
        amount=data.amount,
        method=data.method,
        note=data.note,
        actor_name=actor_name,
        actor_cred_id=cred_id,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    customer = CustomerRepository.get_by_id(db, staff["tenant_id"], customer_id)
    settlement_payload = KhataSettlementData.model_validate(result["settlement"]).model_dump(mode="json")
    return success_response(
        data={
            "settlement": settlement_payload,
            "new_balance": str(result["new_balance"]),
            "customer": _customer_payload(db, staff["tenant_id"], customer),
        },
        message=f"Recorded Rs {result['settlement'].amount} via {result['settlement'].method}",
        status_code=201,
    )
