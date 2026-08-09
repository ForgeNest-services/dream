from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, require_role, require_restro_staff
from utils.helpers import success_response, error_response
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
)
from features.restro.service import RestroCredentialService, RestroAuthService
from features.restro.category_service import CategoryService
from features.restro.menu_item_service import MenuItemService
from features.restro.zone_service import ZoneService
from features.restro.table_service import TableService


router = APIRouter(prefix="/restro", tags=["restro"])


def _assert_branch_scope(staff: dict, branch_id: str) -> None:
    """Managers/waiters/chefs can only touch their own branch. Owner spans all."""
    if staff["role"] == "owner":
        return
    if staff.get("branch_id") != branch_id:
        raise HTTPException(403, "Not allowed for this branch")


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
