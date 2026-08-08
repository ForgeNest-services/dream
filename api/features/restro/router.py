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
)
from features.restro.service import RestroCredentialService, RestroAuthService
from features.restro.category_service import CategoryService
from features.restro.menu_item_service import MenuItemService


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
