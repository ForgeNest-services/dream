from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, require_role, require_ims_staff
from utils.helpers import success_response, error_response
from features.ims.schemas import (
    CreateCredentialRequest,
    UpdateCredentialRequest,
    CredentialData,
    StaffLoginRequest,
    StaffLoginResponse,
    CategoryData,
    CreateCategoryRequest,
    UpdateCategoryRequest,
    BrandData,
    CreateBrandRequest,
    UnitData,
)
from features.ims.service import IMSCredentialService, IMSAuthService
from features.ims.category_service import IMSCategoryService
from features.ims.brand_service import IMSBrandService
from features.ims.unit_service import IMSUnitService


router = APIRouter(prefix="/ims", tags=["ims"])


# ---------------------------------------------------------------------------
# Staff-facing (public) - login from ims.dream.com
# ---------------------------------------------------------------------------

@router.post("/auth/login")
def staff_login(data: StaffLoginRequest, db: Session = Depends(get_db)):
    result = IMSAuthService.login(db, data.username, data.password)

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
    creds = IMSCredentialService.list_for_tenant(db, user.tenant_id)
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
    result = IMSCredentialService.create(
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
        if code == "BRANCH_REQUIRED":
            return error_response(
                "BRANCH_REQUIRED", "This role requires a branch.", 422
            )
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
    result = IMSCredentialService.update(
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
    result = IMSCredentialService.delete(db, tenant_id=user.tenant_id, cred_id=cred_id)

    if not result["success"]:
        return error_response("CREDENTIAL_NOT_FOUND", "Credential not found.", 404)

    return success_response(data={"deleted": True}, message="Credential removed")


# ---------------------------------------------------------------------------
# Categories (staff-facing, tenant-wide tree — not branch-scoped)
# ---------------------------------------------------------------------------

_CATEGORY_ERROR_MAP = {
    "PARENT_NOT_FOUND": ("PARENT_NOT_FOUND", "Parent category not found.", 404),
    "CATEGORY_NOT_FOUND": ("CATEGORY_NOT_FOUND", "Category not found.", 404),
    "NAME_TAKEN": ("NAME_TAKEN", "A category with this name already exists here.", 409),
    "CATEGORY_HAS_CHILDREN": (
        "CATEGORY_HAS_CHILDREN",
        "Remove or move its sub-categories first.",
        409,
    ),
}


def _category_error(code: str):
    mapped = _CATEGORY_ERROR_MAP.get(code, ("CREATION_FAILED", "Failed to save category.", 500))
    return error_response(*mapped)


@router.get("/categories")
def list_categories(
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSCategoryService.list_for_tenant(db, staff["tenant_id"])
    return success_response(
        data=[CategoryData.model_validate(c).model_dump(mode="json") for c in result["categories"]]
    )


@router.post("/categories")
def create_category(
    data: CreateCategoryRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can create categories")
    result = IMSCategoryService.create(db, staff["tenant_id"], data.name, data.parent_id)
    if not result["success"]:
        return _category_error(result["error_code"])
    return success_response(
        data=CategoryData.model_validate(result["category"]).model_dump(mode="json"),
        message="Category created",
        status_code=201,
    )


@router.patch("/categories/{category_id}")
def rename_category(
    category_id: str,
    data: UpdateCategoryRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can rename categories")
    result = IMSCategoryService.rename(db, staff["tenant_id"], category_id, data.name)
    if not result["success"]:
        return _category_error(result["error_code"])
    return success_response(
        data=CategoryData.model_validate(result["category"]).model_dump(mode="json"),
        message="Category renamed",
    )


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete categories")
    result = IMSCategoryService.delete(db, staff["tenant_id"], category_id)
    if not result["success"]:
        return _category_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Category removed")


# ---------------------------------------------------------------------------
# Brands (staff-facing, tenant-wide, flat list — create + list only, no
# rename/delete since the frontend has no UI for either)
# ---------------------------------------------------------------------------

@router.get("/brands")
def list_brands(
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    brands = IMSBrandService.list_for_tenant(db, staff["tenant_id"])
    return success_response(
        data=[BrandData.model_validate(b).model_dump(mode="json") for b in brands]
    )


@router.post("/brands")
def create_brand(
    data: CreateBrandRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can create brands")
    result = IMSBrandService.create(db, staff["tenant_id"], data.name)
    if not result["success"]:
        code = result["error_code"]
        if code == "NAME_TAKEN":
            return error_response("NAME_TAKEN", "A brand with this name already exists.", 409)
        return error_response("CREATION_FAILED", "Failed to create brand.", 500)
    return success_response(
        data=BrandData.model_validate(result["brand"]).model_dump(mode="json"),
        message="Brand created",
        status_code=201,
    )


# ---------------------------------------------------------------------------
# Units (staff-facing, tenant-wide, read-only — auto-seeded with defaults on
# first list call; the frontend has no create/edit UI for units)
# ---------------------------------------------------------------------------

@router.get("/units")
def list_units(
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    units = IMSUnitService.list_for_tenant(db, staff["tenant_id"])
    return success_response(
        data=[UnitData.model_validate(u).model_dump(mode="json") for u in units]
    )
