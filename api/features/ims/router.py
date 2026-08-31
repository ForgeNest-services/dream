from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, require_role, require_ims_staff
from utils.helpers import success_response, error_response
from utils.paging import parse_paging, build_meta
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
    ProductData,
    CreateProductRequest,
    UpdateProductRequest,
    StockMovementData,
    AdjustStockRequest,
    RestockRequest,
    MediaData,
    FiscalYearData,
    CreateFiscalYearRequest,
    PartyData,
    CreatePartyRequest,
    UpdatePartyRequest,
    LedgerEntryData,
    RecordPaymentRequest,
    PurchaseData,
    CreatePurchaseRequest,
    CostHistoryEntry,
    InvoiceData,
    CreateInvoiceRequest,
    ConvertQuotationRequest,
    IMSCreditNoteRequest,
    IMSCbmsCredentialRequest,
    BranchSettingsData,
    UpdateBranchSettingsRequest,
    StockSummaryRow,
    MarginRow,
    PartyStatementRow,
    DashboardData,
)
from features.ims.cbms_service import CBMSService
from features.ims.service import IMSCredentialService, IMSAuthService
from features.ims.category_service import IMSCategoryService
from features.ims.brand_service import IMSBrandService
from features.ims.unit_service import IMSUnitService
from features.ims.product_service import IMSProductService
from features.ims.media_service import IMSMediaService
from features.ims.stock_service import IMSStockService
from features.ims.fiscal_year_service import IMSFiscalYearService
from features.ims.party_service import IMSPartyService, IMSLedgerService
from features.ims.party_repository import IMSLedgerRepository, IMSPartyRepository
from features.ims.purchase_service import IMSPurchaseService
from features.ims.invoice_service import IMSInvoiceService
from features.ims.branch_settings_service import IMSBranchSettingsService
from features.ims.reports_service import IMSReportsService
from features.ims.dashboard_service import IMSDashboardService
from features.ims.category_repository import IMSCategoryRepository
from features.ims.unit_repository import IMSUnitRepository
from features.ims.invoice_repository import IMSInvoiceRepository
from features.ims.purchase_repository import IMSPurchaseRepository
from features.ims.reports_export import build_xlsx, build_pdf
from features.auth.repository import TenantRepository
from utils.bikram_sambat import to_bs_iso


router = APIRouter(prefix="/ims", tags=["ims"])


def _assert_branch_scope(staff: dict, branch_id: str) -> None:
    """Manager/storekeeper/cashier can only touch their own branch. Owner spans all."""
    if staff["role"] == "owner":
        return
    if staff.get("branch_id") != branch_id:
        raise HTTPException(403, "Not allowed for this branch")


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
# Staff-facing credential management — lets the Owner manage Manager/
# Storekeeper logins from inside IMS itself (Settings > Users), without
# going back to the admin app. Gated to the "owner" staff role specifically
# (same authority as platform owner/manager). `created_by` still needs a
# real users.id (FK, not nullable) — we attribute it to the tenant's owner
# User row since a staff actor has no User row of its own.
# ---------------------------------------------------------------------------


def _owner_user_id(db: Session, tenant_id: str) -> str:
    from shared_models import User
    owner = db.query(User).filter(User.tenant_id == tenant_id, User.is_owner.is_(True)).first()
    if not owner:
        owner = db.query(User).filter(User.tenant_id == tenant_id).first()
    return owner.id


@router.get("/staff/credentials")
def staff_list_credentials(
    staff: dict = Depends(require_ims_staff("owner")),
    db: Session = Depends(get_db),
):
    creds = IMSCredentialService.list_for_tenant(db, staff["tenant_id"])
    return success_response(
        data=[CredentialData.model_validate(c).model_dump(mode="json") for c in creds]
    )


@router.post("/staff/credentials")
def staff_create_credential(
    data: CreateCredentialRequest,
    staff: dict = Depends(require_ims_staff("owner")),
    db: Session = Depends(get_db),
):
    result = IMSCredentialService.create(
        db,
        tenant_id=staff["tenant_id"],
        created_by=_owner_user_id(db, staff["tenant_id"]),
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


@router.patch("/staff/credentials/{cred_id}")
def staff_update_credential(
    cred_id: str,
    data: UpdateCredentialRequest,
    staff: dict = Depends(require_ims_staff("owner")),
    db: Session = Depends(get_db),
):
    result = IMSCredentialService.update(
        db,
        tenant_id=staff["tenant_id"],
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


@router.delete("/staff/credentials/{cred_id}")
def staff_delete_credential(
    cred_id: str,
    staff: dict = Depends(require_ims_staff("owner")),
    db: Session = Depends(get_db),
):
    result = IMSCredentialService.delete(db, tenant_id=staff["tenant_id"], cred_id=cred_id)

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


# ---------------------------------------------------------------------------
# Products (staff-facing, tenant-wide catalog; stock is per-branch)
# ---------------------------------------------------------------------------

_PRODUCT_ERROR_MAP = {
    "PRODUCT_NOT_FOUND": ("PRODUCT_NOT_FOUND", "Product not found.", 404),
    "CATEGORY_NOT_FOUND": ("CATEGORY_NOT_FOUND", "Category not found.", 404),
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "SKU_TAKEN": ("SKU_TAKEN", "This SKU is already in use.", 409),
    "BARCODE_TAKEN": ("BARCODE_TAKEN", "This barcode is already used by another product.", 409),
    "VARIANTS_REQUIRED": ("VARIANTS_REQUIRED", "Add at least one variant.", 422),
    "VARIANT_HAS_HISTORY": (
        "VARIANT_HAS_HISTORY",
        "That variant has stock movement history and can't be removed.",
        409,
    ),
}


def _product_error(code: str):
    mapped = _PRODUCT_ERROR_MAP.get(code, ("CREATION_FAILED", "Failed to save product.", 500))
    return error_response(*mapped)


@router.get("/products")
def list_products(
    q: str | None = None,
    category_id: str | None = None,
    brand_id: str | None = None,
    stock_status: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    """category_id accepts a comma-separated list of ids — the frontend
    resolves the category tree (a root + all its descendants) client-side
    and sends the full set, since the category tree is small and already
    loaded there. stock_status is one of: in-stock | low | out."""
    category_ids = [c for c in category_id.split(",") if c] if category_id else None
    paging = parse_paging(page, per_page)
    result = IMSProductService.list_for_tenant(
        db,
        staff["tenant_id"],
        q,
        category_ids,
        brand_id,
        stock_status,
        paging["offset"],
        paging["limit"],
    )
    return success_response(
        data=[ProductData.from_orm_with_variants(p).model_dump(mode="json") for p in result["products"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.get("/products/{product_id}")
def get_product(
    product_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSProductService.get(db, staff["tenant_id"], product_id)
    if not result["success"]:
        return _product_error(result["error_code"])
    return success_response(data=ProductData.from_orm_with_variants(result["product"]).model_dump(mode="json"))


@router.post("/products")
def create_product(
    data: CreateProductRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager", "storekeeper"):
        raise HTTPException(403, "Not allowed to create products")
    result = IMSProductService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id_for_stock=data.branch_id_for_stock,
        user_id=staff.get("cred_id") or "",
        name=data.name,
        sku=data.sku,
        category_id=data.category_id,
        brand_id=data.brand_id,
        media_id=data.media_id,
        description=data.description,
        taxable=data.taxable,
        tax_rate=data.tax_rate,
        variants=[v.model_dump() for v in data.variants],
    )
    if not result["success"]:
        return _product_error(result["error_code"])
    return success_response(
        data=ProductData.from_orm_with_variants(result["product"]).model_dump(mode="json"),
        message="Product created",
        status_code=201,
    )


@router.patch("/products/{product_id}")
def update_product(
    product_id: str,
    data: UpdateProductRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager", "storekeeper"):
        raise HTTPException(403, "Not allowed to edit products")
    result = IMSProductService.update(
        db,
        tenant_id=staff["tenant_id"],
        product_id=product_id,
        name=data.name,
        sku=data.sku,
        category_id=data.category_id,
        brand_id=data.brand_id,
        media_id=data.media_id,
        description=data.description,
        taxable=data.taxable,
        tax_rate=data.tax_rate,
        variants=[v.model_dump() for v in data.variants],
    )
    if not result["success"]:
        return _product_error(result["error_code"])
    return success_response(
        data=ProductData.from_orm_with_variants(result["product"]).model_dump(mode="json"),
        message="Product updated",
    )


@router.delete("/products/{product_id}")
def delete_product(
    product_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete products")
    result = IMSProductService.delete(db, staff["tenant_id"], product_id)
    if not result["success"]:
        return _product_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Product removed")


# ---------------------------------------------------------------------------
# Stock movements (staff-facing) — adjust, restock, and the audit trail list
# ---------------------------------------------------------------------------

_STOCK_ERROR_MAP = {
    "VARIANT_NOT_FOUND": ("VARIANT_NOT_FOUND", "Variant not found.", 404),
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "INVALID_QTY": ("INVALID_QTY", "Quantity must be greater than zero.", 422),
}


def _stock_error(code: str):
    mapped = _STOCK_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to update stock.", 500))
    return error_response(*mapped)


@router.post("/stock/adjust")
def adjust_stock(
    data: AdjustStockRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager", "storekeeper"):
        raise HTTPException(403, "Not allowed to adjust stock")
    result = IMSStockService.adjust(
        db,
        tenant_id=staff["tenant_id"],
        variant_id=data.variant_id,
        branch_id=data.branch_id,
        qty=data.qty,
        reason=data.reason,
        date=data.date,
        user_id=staff.get("cred_id") or "",
    )
    if not result["success"]:
        return _stock_error(result["error_code"])
    return success_response(
        data=StockMovementData.model_validate(result["movement"]).model_dump(mode="json"),
        message="Stock adjusted",
    )


@router.post("/stock/restock")
def restock(
    data: RestockRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager", "storekeeper"):
        raise HTTPException(403, "Not allowed to restock")
    result = IMSStockService.restock(
        db,
        tenant_id=staff["tenant_id"],
        variant_id=data.variant_id,
        branch_id=data.branch_id,
        qty=data.qty,
        unit_cost=data.unit_cost,
        date=data.date,
        user_id=staff.get("cred_id") or "",
        supplier_id=data.supplier_id,
        reference=data.reference,
    )
    if not result["success"]:
        return _stock_error(result["error_code"])
    return success_response(
        data=StockMovementData.model_validate(result["movement"]).model_dump(mode="json"),
        message="Stock received",
    )


@router.get("/stock/movements")
def list_movements(
    branch_id: str | None = None,
    variant_id: str | None = None,
    type: str | None = None,
    q: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    """bs_from / bs_to accept Bikram Sambat dates as "YYYY-MM-DD" strings
    and hit the (branch_id, date_bs) index — see IMSStockMovement.date_bs."""
    paging = parse_paging(page, per_page)
    result = IMSStockService.list_movements(
        db,
        staff["tenant_id"],
        branch_id,
        variant_id,
        type,
        q,
        bs_from,
        bs_to,
        paging["offset"],
        paging["limit"],
    )
    return success_response(
        data=[StockMovementData.model_validate(m).model_dump(mode="json") for m in result["movements"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


# ---------------------------------------------------------------------------
# Media Center (staff-facing, tenant-wide reusable image library)
# ---------------------------------------------------------------------------

_MEDIA_ERROR_MAP = {
    "UNSUPPORTED_FILE_TYPE": ("UNSUPPORTED_FILE_TYPE", "File type not allowed.", 415),
    "FILE_TOO_LARGE": ("FILE_TOO_LARGE", "File must be 5MB or smaller.", 413),
    "MEDIA_NOT_FOUND": ("MEDIA_NOT_FOUND", "Image not found.", 404),
    "MEDIA_IN_USE": ("MEDIA_IN_USE", "This image is used by one or more products.", 409),
}


def _media_error(code: str):
    mapped = _MEDIA_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to process image.", 500))
    return error_response(*mapped)


@router.get("/media")
def list_media(
    q: str | None = None,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    items = IMSMediaService.list_for_tenant(db, staff["tenant_id"], q)
    return success_response(data=[MediaData.model_validate(m).model_dump(mode="json") for m in items])


@router.post("/media")
async def upload_media(
    folder: str = Form("Uploads"),
    file: UploadFile = File(...),
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager", "storekeeper"):
        raise HTTPException(403, "Not allowed to upload images")
    content = await file.read()
    result = IMSMediaService.upload(
        db,
        tenant_id=staff["tenant_id"],
        filename=file.filename or "upload",
        content=content,
        content_type=file.content_type or "",
        folder=folder,
    )
    if not result["success"]:
        return _media_error(result["error_code"])
    return success_response(
        data=MediaData.model_validate(result["media"]).model_dump(mode="json"),
        message="Image uploaded",
        status_code=201,
    )


@router.delete("/media/{media_id}")
def delete_media(
    media_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete images")
    result = IMSMediaService.delete(db, staff["tenant_id"], media_id)
    if not result["success"]:
        return _media_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Image removed")


# ---------------------------------------------------------------------------
# Fiscal years (staff-facing, tenant-wide) — drives document numbering for
# purchases/invoices/quotations (Phase 4/5). Auto-seeded with the current +
# prior 2 BS years on first list call, current one active.
# ---------------------------------------------------------------------------

_FISCAL_YEAR_ERROR_MAP = {
    "FISCAL_YEAR_NOT_FOUND": ("FISCAL_YEAR_NOT_FOUND", "Fiscal year not found.", 404),
    "YEAR_EXISTS": ("YEAR_EXISTS", "This fiscal year already exists.", 409),
    "NO_FISCAL_YEAR": ("NO_FISCAL_YEAR", "No fiscal year is set up yet.", 404),
    "CANNOT_DELETE_ACTIVE": (
        "CANNOT_DELETE_ACTIVE",
        "Switch to a different active fiscal year before deleting this one.",
        409,
    ),
}


def _fiscal_year_error(code: str):
    mapped = _FISCAL_YEAR_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to process fiscal year.", 500))
    return error_response(*mapped)


@router.get("/fiscal-years")
def list_fiscal_years(
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    years = IMSFiscalYearService.list_for_tenant(db, staff["tenant_id"])
    return success_response(
        data=[FiscalYearData.model_validate(y).model_dump(mode="json") for y in years]
    )


@router.get("/fiscal-years/active")
def get_active_fiscal_year(
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSFiscalYearService.get_active(db, staff["tenant_id"])
    if not result["success"]:
        return _fiscal_year_error(result["error_code"])
    return success_response(
        data=FiscalYearData.model_validate(result["fiscal_year"]).model_dump(mode="json")
    )


@router.post("/fiscal-years")
def create_fiscal_year(
    data: CreateFiscalYearRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] != "owner":
        raise HTTPException(403, "Only the Owner can add fiscal years")
    result = IMSFiscalYearService.create(db, staff["tenant_id"], data.start_year)
    if not result["success"]:
        return _fiscal_year_error(result["error_code"])
    return success_response(
        data=FiscalYearData.model_validate(result["fiscal_year"]).model_dump(mode="json"),
        message="Fiscal year created",
        status_code=201,
    )


@router.post("/fiscal-years/{fy_id}/activate")
def activate_fiscal_year(
    fy_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] != "owner":
        raise HTTPException(403, "Only the Owner can switch the active fiscal year")
    result = IMSFiscalYearService.set_active(db, staff["tenant_id"], fy_id)
    if not result["success"]:
        return _fiscal_year_error(result["error_code"])
    return success_response(
        data=FiscalYearData.model_validate(result["fiscal_year"]).model_dump(mode="json"),
        message="Fiscal year activated",
    )


@router.delete("/fiscal-years/{fy_id}")
def delete_fiscal_year(
    fy_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] != "owner":
        raise HTTPException(403, "Only the Owner can delete fiscal years")
    result = IMSFiscalYearService.delete(db, staff["tenant_id"], fy_id)
    if not result["success"]:
        return _fiscal_year_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Fiscal year removed")


# ---------------------------------------------------------------------------
# Parties (customers + suppliers, staff-facing, tenant-wide) + party ledger
# ---------------------------------------------------------------------------

_PARTY_ERROR_MAP = {
    "PARTY_NOT_FOUND": ("PARTY_NOT_FOUND", "Party not found.", 404),
    "INVALID_AMOUNT": ("INVALID_AMOUNT", "Amount must be greater than zero.", 422),
    "HAS_PURCHASE_HISTORY": (
        "HAS_PURCHASE_HISTORY",
        "This party has purchase bills recorded against it and can't be deleted.",
        409,
    ),
}


def _party_error(code: str):
    mapped = _PARTY_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to process request.", 500))
    return error_response(*mapped)


@router.get("/parties")
def list_parties(
    kind: str | None = None,
    q: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    paging = parse_paging(page, per_page)
    result = IMSPartyService.list_for_tenant(
        db, staff["tenant_id"], kind, q, paging["offset"], paging["limit"]
    )
    return success_response(
        data=[PartyData.model_validate(p).model_dump(mode="json") for p in result["parties"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.post("/parties")
def create_party(
    data: CreatePartyRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSPartyService.create(
        db,
        tenant_id=staff["tenant_id"],
        name=data.name,
        kind=data.kind,
        phone=data.phone,
        email=data.email,
        address=data.address,
        pan=data.pan,
        is_vat_registered=data.is_vat_registered,
        credit_limit=data.credit_limit,
        opening_balance=data.opening_balance,
        terms=data.terms,
    )
    return success_response(
        data=PartyData.model_validate(result["party"]).model_dump(mode="json"),
        message="Party created",
        status_code=201,
    )


@router.patch("/parties/{party_id}")
def update_party(
    party_id: str,
    data: UpdatePartyRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSPartyService.update(
        db,
        tenant_id=staff["tenant_id"],
        party_id=party_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        address=data.address,
        pan=data.pan,
        is_vat_registered=data.is_vat_registered,
        credit_limit=data.credit_limit,
        opening_balance=data.opening_balance,
        terms=data.terms,
    )
    if not result["success"]:
        return _party_error(result["error_code"])
    return success_response(
        data=PartyData.model_validate(result["party"]).model_dump(mode="json"),
        message="Party updated",
    )


@router.delete("/parties/{party_id}")
def delete_party(
    party_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete parties")
    result = IMSPartyService.delete(db, staff["tenant_id"], party_id)
    if not result["success"]:
        return _party_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Party removed")


@router.get("/parties/{party_id}/ledger")
def get_party_ledger(
    party_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSLedgerService.list_for_party(db, staff["tenant_id"], party_id)
    if not result["success"]:
        return _party_error(result["error_code"])
    return success_response(
        data=[LedgerEntryData.model_validate(e).model_dump(mode="json") for e in result["entries"]]
    )


@router.get("/ledger")
def list_all_ledger_entries(
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    """Full tenant ledger — lets the frontend compute every party's balance
    client-side in one request instead of N calls, matching how partyBalance
    is derived today (loop over the whole ledger array)."""
    entries = IMSLedgerRepository.list_for_tenant(db, staff["tenant_id"])
    return success_response(
        data=[LedgerEntryData.model_validate(e).model_dump(mode="json") for e in entries]
    )


@router.post("/ledger/payments")
def record_payment(
    data: RecordPaymentRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSLedgerService.record_payment(
        db,
        tenant_id=staff["tenant_id"],
        party_id=data.party_id,
        amount=data.amount,
        date=data.date,
        method=data.method,
        reference=data.reference,
    )
    if not result["success"]:
        return _party_error(result["error_code"])
    return success_response(
        data=LedgerEntryData.model_validate(result["entry"]).model_dump(mode="json"),
        message="Payment recorded",
        status_code=201,
    )


# ---------------------------------------------------------------------------
# Purchases (staff-facing) — bulk product entry against a supplier bill,
# receives stock and optionally posts to the party ledger, all atomically.
# ---------------------------------------------------------------------------

_PURCHASE_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "PARTY_NOT_FOUND": ("PARTY_NOT_FOUND", "Party not found.", 404),
    "PRODUCT_NOT_FOUND": ("PRODUCT_NOT_FOUND", "Product not found.", 404),
    "CATEGORY_NOT_FOUND": ("CATEGORY_NOT_FOUND", "Category not found.", 404),
    "SKU_TAKEN": ("SKU_TAKEN", "SKU is already in use.", 409),
    "NO_ITEMS": ("NO_ITEMS", "Add at least one item with a quantity.", 422),
    "CREATION_FAILED": ("CREATION_FAILED", "Failed to record purchase.", 500),
}


def _purchase_error(code: str):
    mapped = _PURCHASE_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to process request.", 500))
    return error_response(*mapped)


@router.get("/purchases")
def list_purchases(
    branch_id: str | None = None,
    party_id: str | None = None,
    fiscal_year_id: str | None = None,
    q: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    """bs_from / bs_to accept Bikram Sambat dates as "YYYY-MM-DD" strings
    and hit the (branch_id, date_bs) index — see IMSPurchase.date_bs."""
    paging = parse_paging(page, per_page)
    result = IMSPurchaseService.list_for_tenant(
        db,
        staff["tenant_id"],
        branch_id,
        party_id,
        fiscal_year_id,
        q,
        bs_from,
        bs_to,
        paging["offset"],
        paging["limit"],
    )
    return success_response(
        data=[PurchaseData.model_validate(p).model_dump(mode="json") for p in result["purchases"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.post("/purchases")
def create_purchase(
    data: CreatePurchaseRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager", "storekeeper"):
        raise HTTPException(403, "Not allowed to record purchases")
    result = IMSPurchaseService.create(
        db,
        tenant_id=staff["tenant_id"],
        user_id=staff.get("cred_id") or "",
        date=data.date,
        branch_id=data.branch_id,
        party_id=data.party_id,
        bill_no=data.bill_no,
        note=data.note,
        bill_amount=data.bill_amount,
        paid_amount=data.paid_amount,
        payment_method=data.payment_method,
        post_to_ledger=data.post_to_ledger,
        items=[item.model_dump() for item in data.items],
    )
    if not result["success"]:
        return _purchase_error(result["error_code"])
    return success_response(
        data=PurchaseData.model_validate(result["purchase"]).model_dump(mode="json"),
        message="Purchase recorded",
        status_code=201,
    )


@router.get("/variants/{variant_id}/cost-history")
def get_cost_history(
    variant_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSPurchaseService.cost_history_for_variant(db, staff["tenant_id"], variant_id)
    if not result["success"]:
        raise HTTPException(404, "Variant not found")
    return success_response(
        data=[CostHistoryEntry.model_validate(e).model_dump(mode="json") for e in result["entries"]],
    )


# ---------------------------------------------------------------------------
# Invoices (staff-facing) — POS checkout: deducts stock and posts a
# sale/payment pair to the customer ledger, all atomically.
# ---------------------------------------------------------------------------

_INVOICE_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "CUSTOMER_NOT_FOUND": ("CUSTOMER_NOT_FOUND", "Customer not found.", 404),
    "VARIANT_NOT_FOUND": ("VARIANT_NOT_FOUND", "Variant not found.", 404),
    "NO_ITEMS": ("NO_ITEMS", "Add at least one item to the cart.", 422),
    "CREATION_FAILED": ("CREATION_FAILED", "Failed to record sale.", 500),
    "INVOICE_NOT_FOUND": ("INVOICE_NOT_FOUND", "Quotation not found.", 404),
    "DOCUMENT_NOT_FOUND": ("DOCUMENT_NOT_FOUND", "Invoice or quotation not found.", 404),
    "NOT_A_QUOTATION": ("NOT_A_QUOTATION", "This document is not a quotation.", 422),
    "CONVERSION_FAILED": ("CONVERSION_FAILED", "Failed to convert quotation.", 500),
    "INSUFFICIENT_STOCK": ("INSUFFICIENT_STOCK", "Not enough stock for one or more items.", 409),
    "NOT_AN_INVOICE": ("NOT_AN_INVOICE", "Credit notes can only be issued against tax or abbreviated invoices.", 409),
    "ALREADY_CREDIT_NOTE": ("ALREADY_CREDIT_NOTE", "This document is already a credit note.", 409),
    "CN_FAILED": ("CN_FAILED", "Failed to issue credit note.", 500),
}


def _invoice_error(result: dict):
    code = result["error_code"]
    mapped = _INVOICE_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to process request.", 500))
    error_code, default_message, status_code = mapped
    return error_response(
        error_code, result.get("message", default_message), status_code, result.get("details")
    )


@router.get("/invoices")
def list_invoices(
    branch_id: str | None = None,
    customer_id: str | None = None,
    fiscal_year_id: str | None = None,
    status: str | None = None,
    kind: str | None = None,
    q: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    """bs_from / bs_to accept Bikram Sambat dates as "YYYY-MM-DD" strings
    and hit the (branch_id, date_bs) index — see IMSInvoice.date_bs.
    kind="quotation" lists quotations; any other value (including omitted)
    lists real invoices only — quotations never show up there."""
    paging = parse_paging(page, per_page)
    result = IMSInvoiceService.list_for_tenant(
        db,
        staff["tenant_id"],
        branch_id,
        customer_id,
        fiscal_year_id,
        status,
        kind,
        q,
        bs_from,
        bs_to,
        paging["offset"],
        paging["limit"],
    )
    return success_response(
        data=[InvoiceData.model_validate(i).model_dump(mode="json") for i in result["invoices"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSInvoiceService.get(db, staff["tenant_id"], invoice_id)
    if not result["success"]:
        return _invoice_error(result)
    return success_response(data=InvoiceData.model_validate(result["invoice"]).model_dump(mode="json"))


@router.post("/invoices")
def create_invoice(
    request: Request,
    data: CreateInvoiceRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager", "cashier"):
        raise HTTPException(403, "Not allowed to record sales")
    client_ip = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or (
        request.client.host if request.client else None
    )
    result = IMSInvoiceService.create(
        db,
        tenant_id=staff["tenant_id"],
        user_id=staff.get("cred_id") or "",
        date=data.date,
        branch_id=data.branch_id,
        customer_id=data.customer_id,
        payment_method=data.payment_method,
        paid_amount=data.paid_amount,
        note=data.note,
        lines=[line.model_dump() for line in data.lines],
        invoice_prefix=data.invoice_prefix,
        is_quotation=data.is_quotation,
        show_vat_breakdown=data.show_vat_breakdown,
        terminal_ip=client_ip,
    )
    if not result["success"]:
        return _invoice_error(result)
    return success_response(
        data=InvoiceData.model_validate(result["invoice"]).model_dump(mode="json"),
        message="Quotation saved" if data.is_quotation else "Sale recorded",
        status_code=201,
    )


@router.post("/invoices/{invoice_id}/convert")
def convert_quotation(
    request: Request,
    invoice_id: str,
    data: ConvertQuotationRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager", "cashier"):
        raise HTTPException(403, "Not allowed to convert quotations")
    client_ip = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or (
        request.client.host if request.client else None
    )
    result = IMSInvoiceService.convert(
        db,
        tenant_id=staff["tenant_id"],
        user_id=staff.get("cred_id") or "",
        invoice_id=invoice_id,
        invoice_prefix=data.invoice_prefix,
        payment_method=data.payment_method,
        paid_amount=data.paid_amount,
        show_vat_breakdown=data.show_vat_breakdown,
        terminal_ip=client_ip,
    )
    if not result["success"]:
        return _invoice_error(result)
    return success_response(
        data=InvoiceData.model_validate(result["invoice"]).model_dump(mode="json"),
        message="Quotation converted to invoice",
    )


@router.post("/invoices/{invoice_id}/credit-note")
def issue_credit_note(
    request: Request,
    invoice_id: str,
    data: IMSCreditNoteRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can issue credit notes")
    client_ip = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or (
        request.client.host if request.client else None
    )
    result = IMSInvoiceService.issue_credit_note(
        db,
        tenant_id=staff["tenant_id"],
        user_id=staff.get("cred_id") or "",
        invoice_id=invoice_id,
        reason=data.reason,
        terminal_ip=client_ip,
    )
    if not result["success"]:
        return _invoice_error(result)
    return success_response(
        data=InvoiceData.model_validate(result["invoice"]).model_dump(mode="json"),
        message="Credit note issued",
        status_code=201,
    )


@router.get("/invoices/{invoice_id}/cbms-payload")
def get_cbms_payload(
    invoice_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    inv = IMSInvoiceRepository.get_by_id(db, staff["tenant_id"], invoice_id)
    if not inv:
        return error_response("NOT_FOUND", "Invoice not found", 404)
    if inv.kind not in ("tax", "abbreviated"):
        return error_response("NOT_AN_INVOICE", "Only tax/abbreviated invoices can be submitted to CBMS", 400)
    result = CBMSService.get_payload(db, inv, staff["tenant_id"])
    if not result["success"]:
        return error_response(result["error_code"], "CBMS credentials not configured for this tenant", 400)
    return success_response(data=result["payload"])


@router.post("/invoices/{invoice_id}/cbms-sync")
def sync_to_cbms(
    invoice_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can sync invoices to CBMS")
    inv = IMSInvoiceRepository.get_by_id(db, staff["tenant_id"], invoice_id)
    if not inv:
        return error_response("NOT_FOUND", "Invoice not found", 404)
    if inv.kind not in ("tax", "abbreviated"):
        return error_response("NOT_AN_INVOICE", "Only tax/abbreviated invoices can be submitted to CBMS", 400)
    result = CBMSService.sync_invoice(db, inv, staff["tenant_id"])
    if not result["success"]:
        return error_response(result["error_code"], result.get("detail", "CBMS sync failed"), 400)
    return success_response(data={"synced": True, "message": "Invoice submitted to IRD CBMS successfully"})


@router.get("/cbms-credentials")
def get_cbms_credentials(
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can view CBMS credentials")
    result = CBMSService.get_credentials(db, staff["tenant_id"])
    if not result["success"] and result["error_code"] == "CBMS_NOT_CONFIGURED":
        return success_response(data={"configured": False})
    return success_response(data={"configured": True, **result.get("credentials", {})})


@router.put("/cbms-credentials")
def save_cbms_credentials(
    body: IMSCbmsCredentialRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] != "owner":
        raise HTTPException(403, "Only the owner can configure CBMS credentials")
    result = CBMSService.save_credentials(db, staff["tenant_id"], body.ird_username, body.ird_password)
    if not result["success"]:
        return error_response(result["error_code"], "Failed to save CBMS credentials", 400)
    return success_response(data={"saved": True})


# ---------------------------------------------------------------------------
# Branch settings (staff-facing) — whether VAT is currently applied on
# bills, and at what rate. Gates VAT UI across Purchase/Inventory/Invoices/POS.
# ---------------------------------------------------------------------------

_BRANCH_SETTINGS_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "INVALID_VAT_RATE": ("INVALID_VAT_RATE", "VAT rate must be between 0 and 100.", 422),
    "NOT_VAT_REGISTERED": (
        "NOT_VAT_REGISTERED",
        "This business isn't VAT-registered — update PAN/VAT status in the admin app first.",
        409,
    ),
}


def _branch_settings_error(code: str):
    mapped = _BRANCH_SETTINGS_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to update settings.", 500))
    return error_response(*mapped)


@router.get("/branches/{branch_id}/settings")
def get_branch_settings(
    branch_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = IMSBranchSettingsService.get_or_create(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return _branch_settings_error(result["error_code"])
    return success_response(
        data=BranchSettingsData.model_validate(result["settings"]).model_dump(mode="json")
    )


@router.patch("/branches/{branch_id}/settings")
def update_branch_settings(
    branch_id: str,
    data: UpdateBranchSettingsRequest,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can change settings")
    _assert_branch_scope(staff, branch_id)
    result = IMSBranchSettingsService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        vat_enabled=data.vat_enabled,
        vat_rate=data.vat_rate,
        qr_image_url=data.qr_image_url,
        clear_qr=data.clear_qr,
    )
    if not result["success"]:
        return _branch_settings_error(result["error_code"])
    return success_response(
        data=BranchSettingsData.model_validate(result["settings"]).model_dump(mode="json"),
        message="Settings updated",
    )


@router.delete("/branches/{branch_id}/settings/qr")
def clear_branch_qr(
    branch_id: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    """Dedicated endpoint for the "Remove QR" button. Same as PATCH with
    clear_qr=true but a plain DELETE reads more clearly in the UI code."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can change settings")
    _assert_branch_scope(staff, branch_id)
    result = IMSBranchSettingsService.clear_qr(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return _branch_settings_error(result["error_code"])
    return success_response(
        data=BranchSettingsData.model_validate(result["settings"]).model_dump(mode="json"),
        message="QR removed",
    )


# ---------------------------------------------------------------------------
# Reports (aggregation endpoints — Sales/Purchase/VAT-register reports reuse
# GET /invoices and GET /purchases directly; only the genuinely new
# aggregations live here)
# ---------------------------------------------------------------------------


def _category_path_map(db: Session, tenant_id: str) -> dict[str, str]:
    """id -> "Parent / Child" path string, mirroring the frontend's
    app.categoryPath — built once per request from the full (small)
    category list rather than a recursive SQL query."""
    categories = IMSCategoryRepository.list_for_tenant(db, tenant_id)
    by_id = {c.id: c for c in categories}

    def path(cid: str) -> str:
        c = by_id.get(cid)
        if not c:
            return "—"
        return f"{path(c.parent_id)} / {c.name}" if c.parent_id else c.name

    return {c.id: path(c.id) for c in categories}


@router.get("/reports/stock-summary")
def report_stock_summary(
    branch_id: str | None = None,
    category_id: str | None = None,
    q: str | None = None,
    low_stock_only: bool = False,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    paging = parse_paging(page, per_page)
    result = IMSReportsService.stock_summary(
        db, staff["tenant_id"], branch_id, category_id, q, low_stock_only,
        paging["offset"], paging["limit"],
    )
    paths = _category_path_map(db, staff["tenant_id"])
    unit_symbols = {u.id: u.symbol for u in IMSUnitRepository.list_for_tenant(db, staff["tenant_id"])}
    rows = [
        StockSummaryRow(
            variant_id=r["variant"].id,
            product_id=r["product"].id,
            product_name=r["product"].name,
            variant_name=r["variant"].name,
            category_path=paths.get(r["product"].category_id, "—"),
            unit_symbol=unit_symbols.get(r["variant"].unit_id, ""),
            stock_qty=r["stock_qty"],
            low_stock_at=r["variant"].low_stock_at,
            cost_price=r["variant"].cost_price,
            selling_price=r["variant"].selling_price,
            cost_value=r["stock_qty"] * r["variant"].cost_price,
            retail_value=r["stock_qty"] * r["variant"].selling_price,
        )
        for r in result["rows"]
    ]
    return success_response(
        data=[row.model_dump(mode="json") for row in rows],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.get("/reports/margin")
def report_margin(
    branch_id: str | None = None,
    category_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    paging = parse_paging(page, per_page)
    result = IMSReportsService.margin(
        db, staff["tenant_id"], branch_id, category_id, bs_from, bs_to,
        paging["offset"], paging["limit"],
    )
    rows = []
    for r in result["rows"]:
        profit = r["revenue"] - r["cost"]
        margin_pct = (profit / r["revenue"] * 100) if r["revenue"] else 0
        rows.append(
            MarginRow(
                variant_id=r["variant"].id,
                product_id=r["product"].id,
                product_name=r["product"].name,
                variant_name=r["variant"].name,
                qty_sold=r["qty_sold"],
                revenue=r["revenue"],
                cost=r["cost"],
                profit=profit,
                margin_pct=margin_pct,
            )
        )
    return success_response(
        data=[row.model_dump(mode="json") for row in rows],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.get("/reports/party-statement")
def report_party_statement(
    kind: str,
    q: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if kind not in ("customer", "supplier"):
        return error_response("INVALID_KIND", "kind must be 'customer' or 'supplier'.", 422)
    paging = parse_paging(page, per_page)
    result = IMSReportsService.party_statement(
        db, staff["tenant_id"], kind, q, bs_from, bs_to, paging["offset"], paging["limit"],
    )
    rows = [
        PartyStatementRow(
            party_id=r["party"].id,
            name=r["party"].name,
            pan=r["party"].pan,
            phone=r["party"].phone,
            period_debit=r["period_debit"],
            period_credit=r["period_credit"],
            balance=r["balance"],
        )
        for r in result["rows"]
    ]
    return success_response(
        data=[row.model_dump(mode="json") for row in rows],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


# ---------------------------------------------------------------------------
# Report exports (XLSX / PDF) — always ALL rows matching the filters, not
# just the current page. Each report builds its (title, columns, rows) shape
# from the same query the list endpoint uses (no offset/limit), then hands
# off to the shared build_xlsx/build_pdf in reports_export.py.
# ---------------------------------------------------------------------------

_EXPORT_LIMIT = 100_000  # effectively unbounded — a real safety ceiling, not a UX limit


def _business_header_lines(tenant) -> list[str]:
    """Business name/PAN/address/contact block every export prints at the
    top — same identity info the print-invoice page shows, so an exported
    sheet is self-identifying without the app UI around it."""
    lines = [tenant.name]
    details = []
    if tenant.pan:
        details.append(f"PAN: {tenant.pan}")
    if tenant.business_address:
        details.append(tenant.business_address)
    contact = [c for c in (tenant.business_phone, tenant.business_email) if c]
    if contact:
        details.append(" · ".join(contact))
    lines.extend(details)
    return lines


def _export_response(
    fmt: str,
    title: str,
    columns: list[str],
    rows: list[list],
    business_lines: list[str] | None = None,
    wide: bool = False,
):
    if fmt not in ("xlsx", "pdf"):
        return error_response("INVALID_FORMAT", "format must be 'xlsx' or 'pdf'.", 422)
    if fmt == "xlsx":
        content = build_xlsx(title, columns, rows, business_lines)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ext = "xlsx"
    else:
        content = build_pdf(title, columns, rows, business_lines, wide)
        media_type = "application/pdf"
        ext = "pdf"
    # Content-Disposition's filename param is Latin-1-only — titles built
    # from user data (e.g. a party name) can contain characters like em
    # dashes that aren't. ASCII-fold rather than reject the whole export.
    safe_title = title.lower().replace(" ", "-").encode("ascii", "ignore").decode("ascii") or "export"
    filename = f"{safe_title}.{ext}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/sales/export")
def export_sales_report(
    format: str,
    branch_id: str | None = None,
    fiscal_year_id: str | None = None,
    status: str | None = None,
    q: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    items, _ = IMSInvoiceRepository.list_for_tenant(
        db, staff["tenant_id"], branch_id, None, fiscal_year_id, status, None,
        q, bs_from, bs_to, 0, _EXPORT_LIMIT,
    )
    parties = {p.id: p.name for p in IMSPartyRepository.list_for_tenant(db, staff["tenant_id"], None, None, 0, _EXPORT_LIMIT)[0]}
    columns = ["Invoice", "Date (BS)", "Customer", "Items", "Taxable", "VAT", "Total", "Status"]
    rows = [
        [
            i.number, i.date_bs, parties.get(i.customer_id, "—"), len(i.lines),
            i.taxable_amount, i.vat_amount, i.total_amount, i.status,
        ]
        for i in items
    ]
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _export_response(format, "Sales Report", columns, rows, _business_header_lines(tenant))


@router.get("/reports/vat-register/export")
def export_vat_register(
    format: str,
    branch_id: str | None = None,
    fiscal_year_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    items, _ = IMSInvoiceRepository.list_for_tenant(
        db, staff["tenant_id"], branch_id, None, fiscal_year_id, None, None,
        None, bs_from, bs_to, 0, _EXPORT_LIMIT,
    )
    parties = {p.id: p for p in IMSPartyRepository.list_for_tenant(db, staff["tenant_id"], None, None, 0, _EXPORT_LIMIT)[0]}
    columns = ["Invoice", "Date (BS)", "Buyer", "Buyer PAN", "Taxable", "VAT", "Total"]
    rows = [
        [
            i.number, i.date_bs, parties.get(i.customer_id).name if i.customer_id in parties else "—",
            (parties.get(i.customer_id).pan if i.customer_id in parties else None) or "—",
            i.taxable_amount, i.vat_amount, i.total_amount,
        ]
        for i in items
    ]
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _export_response(format, "VAT Sales Register", columns, rows, _business_header_lines(tenant))


@router.get("/reports/purchases/export")
def export_purchase_report(
    format: str,
    branch_id: str | None = None,
    fiscal_year_id: str | None = None,
    q: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    items, _ = IMSPurchaseRepository.list_for_tenant(
        db, staff["tenant_id"], branch_id, None, fiscal_year_id, q, bs_from, bs_to, 0, _EXPORT_LIMIT,
    )
    parties = {p.id: p.name for p in IMSPartyRepository.list_for_tenant(db, staff["tenant_id"], None, None, 0, _EXPORT_LIMIT)[0]}
    columns = ["Bill", "Bill No.", "Date (BS)", "Supplier", "Items", "Items Total", "Bill Amount", "Paid"]
    rows = [
        [
            p.number, p.bill_no or "—", p.date_bs, parties.get(p.party_id, "Direct") if p.party_id else "Direct",
            len(p.lines), p.items_total, p.bill_amount, p.paid_amount,
        ]
        for p in items
    ]
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _export_response(format, "Purchase Report", columns, rows, _business_header_lines(tenant))


@router.get("/reports/stock-summary/export")
def export_stock_summary(
    format: str,
    branch_id: str | None = None,
    category_id: str | None = None,
    q: str | None = None,
    low_stock_only: bool = False,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSReportsService.stock_summary(
        db, staff["tenant_id"], branch_id, category_id, q, low_stock_only, 0, _EXPORT_LIMIT,
    )
    paths = _category_path_map(db, staff["tenant_id"])
    unit_symbols = {u.id: u.symbol for u in IMSUnitRepository.list_for_tenant(db, staff["tenant_id"])}
    columns = ["Product", "Variant", "Category", "Unit", "Stock", "Reorder At", "Cost Price", "Selling Price", "Cost Value", "Retail Value"]
    rows = [
        [
            r["product"].name, r["variant"].name, paths.get(r["product"].category_id, "—"),
            unit_symbols.get(r["variant"].unit_id, ""), r["stock_qty"], r["variant"].low_stock_at,
            r["variant"].cost_price, r["variant"].selling_price,
            r["stock_qty"] * r["variant"].cost_price, r["stock_qty"] * r["variant"].selling_price,
        ]
        for r in result["rows"]
    ]
    title = "Low Stock Report" if low_stock_only else "Stock Summary"
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _export_response(format, title, columns, rows, _business_header_lines(tenant), wide=True)


@router.get("/reports/margin/export")
def export_margin_report(
    format: str,
    branch_id: str | None = None,
    category_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSReportsService.margin(
        db, staff["tenant_id"], branch_id, category_id, bs_from, bs_to, 0, _EXPORT_LIMIT,
    )
    columns = ["Product", "Variant", "Qty Sold", "Revenue", "Cost", "Profit", "Margin %"]
    rows = []
    for r in result["rows"]:
        profit = r["revenue"] - r["cost"]
        margin_pct = round((profit / r["revenue"] * 100), 2) if r["revenue"] else 0
        rows.append([r["product"].name, r["variant"].name, r["qty_sold"], r["revenue"], r["cost"], profit, margin_pct])
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _export_response(format, "Profit Margin Report", columns, rows, _business_header_lines(tenant))


@router.get("/reports/party-statement/export")
def export_party_statement(
    format: str,
    kind: str,
    q: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    if kind not in ("customer", "supplier"):
        return error_response("INVALID_KIND", "kind must be 'customer' or 'supplier'.", 422)
    result = IMSReportsService.party_statement(
        db, staff["tenant_id"], kind, q, bs_from, bs_to, 0, _EXPORT_LIMIT,
    )
    columns = ["Party", "PAN", "Phone", "Period Debit", "Period Credit", "Balance"]
    rows = [
        [r["party"].name, r["party"].pan or "—", r["party"].phone or "—", r["period_debit"], r["period_credit"], r["balance"]]
        for r in result["rows"]
    ]
    title = "Customer Statement" if kind == "customer" else "Supplier Statement"
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _export_response(format, title, columns, rows, _business_header_lines(tenant))


@router.get("/parties/{party_id}/ledger/export")
def export_party_ledger(
    party_id: str,
    format: str,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    """Full ledger for ONE party with a running balance — distinct from
    /reports/party-statement/export, which is one row per party (totals
    only). Always the complete history, never just what's on screen."""
    party = IMSPartyRepository.get_by_id(db, staff["tenant_id"], party_id)
    if not party:
        return error_response("PARTY_NOT_FOUND", "Party not found.", 404)
    entries = IMSLedgerRepository.list_for_party(db, staff["tenant_id"], party_id)
    is_supplier = party.kind == "supplier"

    columns = ["Date (BS)", "Description", "Reference", "Debit", "Credit", "Balance"]
    rows = []
    balance = Decimal(0)
    for e in entries:
        balance += (e.credit - e.debit) if is_supplier else (e.debit - e.credit)
        rows.append([
            to_bs_iso(e.date) or e.date.strftime("%Y-%m-%d"), e.description, e.reference or "—",
            e.debit, e.credit, balance,
        ])

    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    business_lines = _business_header_lines(tenant)
    business_lines.append(
        f"{'Supplier' if is_supplier else 'Customer'} statement — {party.name}"
        + (f" (PAN: {party.pan})" if party.pan else "")
    )
    title = f"{party.name} - Ledger"
    return _export_response(format, title, columns, rows, business_lines)


# ---------------------------------------------------------------------------
# Dashboard — one endpoint, everything filtered by the same branch_id +
# bs_from/bs_to so a single date-range change updates every section at once.
# ---------------------------------------------------------------------------


@router.get("/dashboard")
def get_dashboard(
    branch_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_ims_staff()),
    db: Session = Depends(get_db),
):
    result = IMSDashboardService.get(db, staff["tenant_id"], branch_id, bs_from, bs_to)
    data = DashboardData(**{k: v for k, v in result.items() if k != "success"})
    return success_response(data=data.model_dump(mode="json"))
