from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from rq import Retry
from core.database import get_db
from core.deps import require_tenant_user, require_role, require_restro_staff
from core.queue import job_queue
from jobs.cbms_jobs import sync_document_job
from features.cbms.credential_service import CBMSCredentialRepository
from features.restro.cbms_service import build_cbms_payload
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
    SetOrderCustomerRequest,
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
    CustomerOrderEntry,
    CustomerHistoryResponse,
    RestroTenantInfo,
    BranchSettingsData,
    UpdateBranchSettingsRequest,
    ExpenseData,
    CreateExpenseRequest,
    UpdateExpenseRequest,
    RMSCreditNoteRequest,
    AuditLogEntryData,
)
from shared_models import Tenant
from features.restro.service import RestroCredentialService, RestroAuthService
from features.restro.category_service import CategoryService
from features.restro.menu_item_service import MenuItemService
from features.restro.zone_service import ZoneService
from features.restro.table_service import TableService
from features.restro.order_service import OrderService
from features.hotel_pms.audit_repository import AuditRepository
from features.restro.order_repository import OrderRepository
from features.restro.inventory_service import InventoryService
from features.restro.employee_service import EmployeeService
from features.restro.customer_service import CustomerService
from features.restro.customer_repository import CustomerRepository
from features.restro.order_service import compute_order_total, order_vat_settings
from features.restro.khata_settlement_repository import KhataSettlementRepository
from features.restro.branch_settings_service import BranchSettingsService
from features.restro.expense_service import ExpenseService
from features.restro.reports_service import ReportsService
from features.restro.public_service import get_public_menu
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


# ---------------------------------------------------------------------------
# Branch settings — VAT + payment QR. Auto-provisioned on first read.
# Any staff can read (waiter needs QR + VAT rate to render the bill / payment
# dialog). Only owner/manager can update, since VAT/QR are business-level.
# ---------------------------------------------------------------------------

_BRANCH_SETTINGS_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "INVALID_VAT_RATE": ("INVALID_VAT_RATE", "VAT rate must be between 0 and 100.", 422),
    "NOT_VAT_REGISTERED": (
        "NOT_VAT_REGISTERED",
        "This business isn't VAT-registered — update PAN/VAT status in the admin app first.",
        422,
    ),
}


def _branch_settings_error(code: str):
    mapped = _BRANCH_SETTINGS_ERROR_MAP.get(
        code, ("SERVER_ERROR", "Failed to update settings.", 500)
    )
    return error_response(*mapped)


@router.get("/branches/{branch_id}/settings")
def get_branch_settings(
    branch_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = BranchSettingsService.get_or_create(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return _branch_settings_error(result["error_code"])
    return success_response(
        data=BranchSettingsData.model_validate(result["settings"]).model_dump(mode="json")
    )


@router.patch("/branches/{branch_id}/settings")
def update_branch_settings(
    branch_id: str,
    data: UpdateBranchSettingsRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can change settings")
    _assert_branch_scope(staff, branch_id)
    result = BranchSettingsService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        vat_enabled=data.vat_enabled,
        vat_rate=data.vat_rate,
        qr_image_url=data.qr_image_url,
        clear_qr=data.clear_qr,
        cbms_realtime_enabled=data.cbms_realtime_enabled,
        default_hs_code=data.default_hs_code,
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
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Dedicated endpoint for the "Remove QR" button. Same as PATCH with
    clear_qr=true but a plain DELETE reads more clearly in the UI code."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can change settings")
    _assert_branch_scope(staff, branch_id)
    result = BranchSettingsService.clear_qr(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return _branch_settings_error(result["error_code"])
    return success_response(
        data=BranchSettingsData.model_validate(result["settings"]).model_dump(mode="json"),
        message="QR removed",
    )


# ---------------------------------------------------------------------------
# Expenses — branch-scoped operating spend. Any staff can log an expense
# (waiter buying utilities on the go); owner/manager can edit/delete.
# ---------------------------------------------------------------------------

_EXPENSE_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "EXPENSE_NOT_FOUND": ("EXPENSE_NOT_FOUND", "Expense not found.", 404),
    "INVALID_AMOUNT": ("INVALID_AMOUNT", "Amount must be greater than zero.", 422),
    "INVALID_DATE": ("INVALID_DATE", "Date must be a valid BS YYYY-MM-DD string.", 422),
}


def _expense_error(code: str):
    mapped = _EXPENSE_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to save expense.", 500))
    return error_response(*mapped)


@router.get("/branches/{branch_id}/expenses")
def list_expenses(
    branch_id: str,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = ExpenseService.list_for_branch(
        db, staff["tenant_id"], branch_id, bs_from, bs_to
    )
    if not result["success"]:
        return _expense_error(result["error_code"])
    return success_response(
        data=[ExpenseData.model_validate(e).model_dump(mode="json") for e in result["expenses"]]
    )


@router.post("/branches/{branch_id}/expenses")
def create_expense(
    branch_id: str,
    data: CreateExpenseRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    actor_name, cred_id = _actor_from_staff(db, staff)
    result = ExpenseService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        category=data.category,
        amount=data.amount,
        note=data.note,
        spent_at_bs=data.spent_at_bs,
        actor_name=actor_name,
        actor_cred_id=cred_id,
    )
    if not result["success"]:
        return _expense_error(result["error_code"])
    return success_response(
        data=ExpenseData.model_validate(result["expense"]).model_dump(mode="json"),
        message="Expense recorded",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/expenses/{expense_id}")
def update_expense(
    branch_id: str,
    expense_id: str,
    data: UpdateExpenseRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can edit expenses")
    _assert_branch_scope(staff, branch_id)
    result = ExpenseService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        expense_id=expense_id,
        category=data.category,
        amount=data.amount,
        note=data.note,
        spent_at_bs=data.spent_at_bs,
        clear_note=data.clear_note,
    )
    if not result["success"]:
        return _expense_error(result["error_code"])
    return success_response(
        data=ExpenseData.model_validate(result["expense"]).model_dump(mode="json"),
        message="Expense updated",
    )


@router.delete("/branches/{branch_id}/expenses/{expense_id}")
def delete_expense(
    branch_id: str,
    expense_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can delete expenses")
    _assert_branch_scope(staff, branch_id)
    result = ExpenseService.delete(db, staff["tenant_id"], branch_id, expense_id)
    if not result["success"]:
        return _expense_error(result["error_code"])
    return success_response(data={"deleted": True}, message="Expense removed")


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
def staff_login(data: StaffLoginRequest, request: Request, db: Session = Depends(get_db)):
    result = RestroAuthService.login(db, data.username, data.password, terminal_ip=_client_ip(request))

    if not result["success"]:
        if result["error_code"] == "SUBSCRIPTION_EXPIRED":
            return error_response(
                "SUBSCRIPTION_EXPIRED",
                "This business's RMS subscription has expired. Contact the business owner.",
                402,
            )
        return error_response(
            "INVALID_CREDENTIALS",
            "Incorrect username or password.",
            401,
        )

    return success_response(
        data=StaffLoginResponse(
            token=result["token"],
            role=result["role"],
            name=result["name"],
            tenant_id=result["tenant_id"],
            branch_id=result["branch_id"],
            expires_at=result["expires_at"],
        ).model_dump(mode="json"),
        message="Logged in",
    )


@router.post("/auth/logout")
def staff_logout(
    request: Request,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    # IRD: Electronic Billing Procedure 2082, clause 6.3ख — no server-side
    # session to invalidate (stateless JWT, see CLAUDE.md §2.6), this just
    # records the event so the activity log has a real logout entry.
    RestroAuthService.logout(db, staff["tenant_id"], staff["cred_id"], terminal_ip=_client_ip(request))
    return success_response(message="Logged out")


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
        name=data.name,
        email=data.email,
        phone=data.phone,
        username=data.username,
        password=data.password,
        branch_id=data.branch_id,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "BRANCH_NOT_FOUND":
            return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
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
        name=data.name,
        email=data.email,
        phone=data.phone,
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
# Staff-facing credential management — lets the Owner manage Manager/Waiter/
# Chef logins from inside Zestro itself (Settings > Users), without going
# back to the admin app. Gated to the "owner" staff role specifically (same
# authority as platform owner/manager). `created_by` still needs a real
# users.id (FK, not nullable) — we attribute it to the tenant's owner User
# row since a staff actor has no User row of its own.
# ---------------------------------------------------------------------------


def _owner_user_id(db: Session, tenant_id: str) -> str:
    from shared_models import User
    owner = db.query(User).filter(User.tenant_id == tenant_id, User.is_owner.is_(True)).first()
    if not owner:
        owner = db.query(User).filter(User.tenant_id == tenant_id).first()
    return owner.id


@router.get("/staff/credentials")
def staff_list_credentials(
    staff: dict = Depends(require_restro_staff("owner")),
    db: Session = Depends(get_db),
):
    creds = RestroCredentialService.list_for_tenant(db, staff["tenant_id"])
    return success_response(
        data=[CredentialData.model_validate(c).model_dump(mode="json") for c in creds]
    )


@router.post("/staff/credentials")
def staff_create_credential(
    data: CreateCredentialRequest,
    staff: dict = Depends(require_restro_staff("owner")),
    db: Session = Depends(get_db),
):
    result = RestroCredentialService.create(
        db,
        tenant_id=staff["tenant_id"],
        created_by=_owner_user_id(db, staff["tenant_id"]),
        role=data.role,
        name=data.name,
        email=data.email,
        phone=data.phone,
        username=data.username,
        password=data.password,
        branch_id=data.branch_id,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "BRANCH_NOT_FOUND":
            return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
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
    staff: dict = Depends(require_restro_staff("owner")),
    db: Session = Depends(get_db),
):
    result = RestroCredentialService.update(
        db,
        tenant_id=staff["tenant_id"],
        cred_id=cred_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
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
    staff: dict = Depends(require_restro_staff("owner")),
    db: Session = Depends(get_db),
):
    result = RestroCredentialService.delete(db, tenant_id=staff["tenant_id"], cred_id=cred_id)

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
    "COMBO_CANNOT_HAVE_VARIANTS": (
        "COMBO_CANNOT_HAVE_VARIANTS",
        "A combo can't have variants — its composition IS the variant.",
        422,
    ),
    "COMPONENTS_REQUIRED": (
        "COMPONENTS_REQUIRED",
        "Add at least one item to the combo.",
        422,
    ),
    "COMPONENTS_NOT_ALLOWED": (
        "COMPONENTS_NOT_ALLOWED",
        "Components are only allowed on combo items.",
        422,
    ),
    "COMPONENT_ITEM_REQUIRED": (
        "COMPONENT_ITEM_REQUIRED",
        "Every combo component needs an item picked.",
        422,
    ),
    "COMPONENT_QTY_INVALID": (
        "COMPONENT_QTY_INVALID",
        "Each combo component needs a quantity of at least 1.",
        422,
    ),
    "COMPONENT_ITEM_NOT_FOUND": (
        "COMPONENT_ITEM_NOT_FOUND",
        "One of the picked combo items no longer exists in this branch.",
        404,
    ),
    "COMPONENT_CANNOT_BE_COMBO": (
        "COMPONENT_CANNOT_BE_COMBO",
        "Combos can't contain other combos — pick regular menu items.",
        422,
    ),
    "COMPONENT_VARIANT_REQUIRED": (
        "COMPONENT_VARIANT_REQUIRED",
        "That component has variants — pick which one the combo uses.",
        422,
    ),
    "COMPONENT_VARIANT_NOT_FOUND": (
        "COMPONENT_VARIANT_NOT_FOUND",
        "That variant no longer exists on the picked item.",
        404,
    ),
    "COMPONENT_SELF_REFERENCE": (
        "COMPONENT_SELF_REFERENCE",
        "A combo can't include itself.",
        422,
    ),
}


def _menu_item_error(code: str):
    mapped = _MENU_ITEM_ERROR_MAP.get(code, ("CREATION_FAILED", "Failed to save menu item.", 500))
    return error_response(*mapped)


@router.get("/branches/{branch_id}/menu-items")
def list_menu_items(
    branch_id: str,
    category_id: str | None = None,
    q: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """`q` is a case-insensitive substring match on the item name. Kept
    optional so existing callers that only pass category_id still work."""
    _assert_branch_scope(staff, branch_id)
    result = MenuItemService.list_for_branch(
        db, staff["tenant_id"], branch_id, category_id, q
    )
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
        is_combo=data.is_combo,
        price=data.price,
        image_url=data.image_url,
        variants=[v.model_dump() for v in data.variants],
        components=[c.model_dump() for c in data.components],
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
        is_combo=data.is_combo,
        price=data.price,
        price_explicitly_null=data.clear_price,
        image_url=data.image_url,
        variants=[v.model_dump() for v in data.variants] if data.variants is not None else None,
        components=(
            [c.model_dump() for c in data.components] if data.components is not None else None
        ),
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
    "ORDER_NOT_PAID": ("ORDER_NOT_PAID", "Only paid orders can have a credit note issued.", 409),
    "ALREADY_CREDIT_NOTE": ("ALREADY_CREDIT_NOTE", "This order is already a credit note.", 409),
    "ABBREVIATED_INVOICE_LIMIT_EXCEEDED": (
        "ABBREVIATED_INVOICE_LIMIT_EXCEEDED",
        "Abbreviated bills can't be issued above Rs 10,000 taxable value — switch to a full VAT bill.",
        422,
    ),
}


def _order_error(code: str):
    mapped = _ORDER_ERROR_MAP.get(code, ("SERVER_ERROR", "Something went wrong.", 500))
    return error_response(*mapped)


def _order_payload(order, slip_numbers: list[int] | None = None) -> dict:
    """Serialize an Order (with lines relationship loaded) to the response
    shape. Kept centralized so every endpoint returns identical structure.
    `slip_numbers` (IRD: Electronic Billing Procedure 2082, clause 6.2घ) is
    opt-in per call site — fetched only where actually consumed (single-order
    fetch, send-to-kitchen) to avoid an N+1 query on list/board views."""
    payload = OrderData.model_validate(order).model_dump(mode="json")
    if slip_numbers is not None:
        payload["slip_numbers"] = slip_numbers
    return payload


def _client_ip(request: Request) -> str | None:
    """Best-effort real client IP for the audit trail — prefers the
    original caller from X-Forwarded-For (set by nginx/whatever's in front)
    over the direct TCP peer, which behind a proxy is just the proxy itself."""
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else getattr(request.client, "host", None)


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
    payment_method: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    q: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Paginated bills-history endpoint. `bs_from` / `bs_to` accept BS dates
    as "YYYY-MM-DD" strings and hit the (branch_id, placed_at_bs) index.
    `payment_method` filters closed bills by how they were paid (cash / qr /
    khata) — the frontend Dues tab passes `khata` here."""
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
        payment_method=payment_method,
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
    slip_numbers = OrderRepository.get_slip_numbers(db, order_id)
    return success_response(data=_order_payload(result["order"], slip_numbers))


@router.post("/branches/{branch_id}/orders")
def create_order(
    branch_id: str,
    data: CreateOrderRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    # Snapshot the staff member's display name (not login username) so the
    # receipt's "Entered by" survives credential renames or deletions.
    # JWT carries `name` from login time; fall back to a DB lookup for tokens
    # issued before this field was added.
    cred_id = staff.get("cred_id")
    entered_by_name = staff.get("name") or staff.get("role") or "staff"
    if not staff.get("name") and cred_id:
        cred = RestroCredentialRepository.get_by_id(db, staff["tenant_id"], cred_id)
        if cred:
            entered_by_name = cred.name
    result = OrderService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        type=data.type,
        table_id=data.table_id,
        customer_id=data.customer_id,
        entered_by_name=entered_by_name,
        entered_by_cred_id=cred_id,
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
    request: Request,
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
        performed_by=staff.get("cred_id"),
        terminal_ip=_client_ip(request),
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
    request: Request,
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
        performed_by=staff.get("cred_id"),
        terminal_ip=_client_ip(request),
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
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        created_by=staff.get("cred_id"),
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    slip_numbers = OrderRepository.get_slip_numbers(db, order_id)
    return success_response(
        data=_order_payload(order, slip_numbers),
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
    request: Request,
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
        performed_by=staff.get("cred_id"),
        terminal_ip=_client_ip(request),
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Discount updated")


@router.patch("/branches/{branch_id}/orders/{order_id}/customer")
def set_order_customer(
    branch_id: str,
    order_id: str,
    data: SetOrderCustomerRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.set_customer(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        customer_id=data.customer_id,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Customer updated")


def _enqueue_cbms_sync(document_type: str, document_id: str, tenant_id: str, db: Session) -> None:
    """Enqueues a CBMS sync job only when the tenant actually needs one:
    VAT-registered + cbms_sync_enabled + credentials present. PAN-only
    businesses and tenants that haven't set up CBMS credentials skip the
    queue entirely — no wasted RQ jobs, no misleading 'pending' log rows."""
    tenant = db.get(Tenant, tenant_id)
    if not tenant or not tenant.is_vat_registered:
        return
    if not CBMSCredentialRepository.get(db, tenant_id):
        return
    job_queue.enqueue(
        sync_document_job,
        "restro",
        document_type,
        document_id,
        tenant_id,
        retry=Retry(max=3, interval=[60, 300, 900]),
    )


@router.post("/branches/{branch_id}/orders/{order_id}/mark-paid")
def mark_order_paid(
    branch_id: str,
    order_id: str,
    data: MarkPaidRequest,
    request: Request,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    client_ip = _client_ip(request)
    result = OrderService.mark_paid(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        payment_method=data.payment_method,
        customer_id=data.customer_id,
        buyer_pan=data.buyer_pan,
        show_vat_breakdown=data.show_vat_breakdown,
        transaction_id=data.transaction_id,
        terminal_ip=client_ip,
        performed_by=staff.get("cred_id"),
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    _enqueue_cbms_sync("invoice", order.id, staff["tenant_id"], db)
    return success_response(data=_order_payload(order), message="Marked as paid")


@router.post("/branches/{branch_id}/orders/{order_id}/cancel")
def cancel_order(
    branch_id: str,
    order_id: str,
    request: Request,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = OrderService.cancel(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        performed_by=staff.get("cred_id"),
        terminal_ip=_client_ip(request),
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id)["order"]
    return success_response(data=_order_payload(order), message="Order cancelled")


@router.post("/branches/{branch_id}/orders/{order_id}/credit-note")
def issue_order_credit_note(
    request: Request,
    branch_id: str,
    order_id: str,
    data: RMSCreditNoteRequest,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can issue credit notes")
    _assert_branch_scope(staff, branch_id)
    client_ip = _client_ip(request)
    result = OrderService.issue_credit_note(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        order_id=order_id,
        reason=data.reason,
        performed_by=staff.get("cred_id"),
        terminal_ip=client_ip,
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    _enqueue_cbms_sync("credit_note", result["order"].id, staff["tenant_id"], db)
    return success_response(
        data=_order_payload(result["order"]),
        message="Credit note issued",
        status_code=201,
    )


@router.post("/branches/{branch_id}/orders/{order_id}/register-print")
def register_order_print(
    branch_id: str,
    order_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Call right before actually printing/showing a paid bill — see
    OrderService.register_print. Returns whether this print should carry the
    "Copy of Original (N)" watermark."""
    _assert_branch_scope(staff, branch_id)
    cred_id = staff.get("cred_id")
    printed_by_name = staff.get("name") or None
    if not printed_by_name and cred_id:
        cred = RestroCredentialRepository.get_by_id(db, staff["tenant_id"], cred_id)
        if cred:
            printed_by_name = cred.name
    result = OrderService.register_print(
        db, staff["tenant_id"], branch_id, order_id,
        printed_by=cred_id, printed_by_name=printed_by_name
    )
    if not result["success"]:
        return _order_error(result["error_code"])
    return success_response(
        data={"is_reprint": result["is_reprint"], "print_count": result["print_count"]}
    )


@router.get("/branches/{branch_id}/orders/{order_id}/cbms-payload")
def get_order_cbms_payload(
    branch_id: str,
    order_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Preview-only — builds the payload without submitting it. Per the
    checklist's self-test item: confirm field construction even without a
    live submit. Password is masked in the response."""
    _assert_branch_scope(staff, branch_id)
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id).get("order")
    if not order:
        return error_response("NOT_FOUND", "Order not found", 404)
    if order.status != "paid":
        return error_response("NOT_PAID", "Only paid bills can be submitted to CBMS", 400)
    org = CBMSCredentialRepository.get(db, staff["tenant_id"])
    if not org:
        return error_response("CBMS_NOT_CONFIGURED", "CBMS sync not enabled for this tenant", 400)
    payload = build_cbms_payload(order, org)
    payload["password"] = "••••••••"
    return success_response(data=payload)


@router.post("/branches/{branch_id}/orders/{order_id}/cbms-sync")
def sync_order_to_cbms(
    branch_id: str,
    order_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Manual resync — runs the same job body inline (not enqueued) so the
    caller gets an immediate result, matching the sync-status UI's
    "Resync" button. Auto-sync on mark-paid/credit-note still goes through
    the RQ queue via _enqueue_cbms_sync above."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can sync bills to CBMS")
    _assert_branch_scope(staff, branch_id)
    order = OrderService.get(db, staff["tenant_id"], branch_id, order_id).get("order")
    if not order:
        return error_response("NOT_FOUND", "Order not found", 404)
    if order.status != "paid":
        return error_response("NOT_PAID", "Only paid bills can be submitted to CBMS", 400)
    document_type = "credit_note" if order.is_credit_note else "invoice"
    try:
        sync_document_job("restro", document_type, order_id, staff["tenant_id"])
    except RuntimeError:
        return error_response("CBMS_SYNC_TRANSIENT", "CBMS sync failed, safe to retry", 400)
    db.refresh(order)
    if not order.cbms_synced:
        return error_response("CBMS_SYNC_FAILED", "CBMS did not accept this document — check the sync log", 400)
    return success_response(data={"synced": True, "message": "Bill submitted to IRD CBMS successfully"})


@router.get("/cbms-sync-log")
def list_restro_cbms_sync_log(
    status: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """App-scoped view of the shared CbmsSyncLog, filtered to source_app
    'restro' — staff hold an app JWT, not the platform JWT the shared
    /tax-settings/sync-log endpoint requires."""
    from features.cbms.sync_log import CbmsSyncLogRepository

    paging = parse_paging(page, per_page)
    items, total = CbmsSyncLogRepository.list_for_tenant(
        db, staff["tenant_id"], "restro", status, paging["offset"], paging["limit"]
    )
    data = [
        {
            "id": r.id,
            "document_type": r.document_type,
            "document_id": r.document_id,
            "document_number": r.document_number,
            "status": r.status,
            "cbms_response_code": r.cbms_response_code,
            "attempt_count": r.attempt_count,
            "last_attempted_at": r.last_attempted_at,
            "synced_at": r.synced_at,
        }
        for r in items
    ]
    return success_response(data=data, meta=build_meta(total, paging["page"], paging["per_page"]))


@router.post("/cbms-sync-log/{log_id}/resync")
def resync_restro_document(
    log_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can resync CBMS documents")
    from features.cbms.sync_log import CbmsSyncLogRepository

    row = CbmsSyncLogRepository.get_by_id(db, staff["tenant_id"], log_id)
    if not row or row.source_app != "restro":
        return error_response("NOT_FOUND", "Sync log entry not found", 404)
    try:
        sync_document_job("restro", row.document_type, row.document_id, staff["tenant_id"])
    except RuntimeError:
        return error_response("CBMS_SYNC_TRANSIENT", "CBMS sync failed, safe to retry", 400)
    db.refresh(row)
    return success_response(data={"status": row.status})


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
    """Snapshot the acting user's display name so audit/movement logs survive
    credential renames or deletions. JWT carries `name` since the multi-user
    credential update; fall back to a DB lookup for older tokens."""
    cred_id = staff.get("cred_id")
    name = staff.get("name") or staff.get("role") or "staff"
    if not staff.get("name") and cred_id:
        cred = RestroCredentialRepository.get_by_id(db, staff["tenant_id"], cred_id)
        if cred:
            name = cred.name
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
    # Khata orders are always paid (khata is only set at mark-paid time), so
    # total_amount is always a real snapshot — never recompute live here.
    order_entries = [
        KhataOrderEntry(
            id=o.id,
            type=o.type,
            placed_at=o.placed_at,
            placed_at_bs=o.placed_at_bs,
            total=Decimal(o.total_amount or 0),
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


@router.get("/branches/{branch_id}/customers/{customer_id}/history")
def customer_history(
    branch_id: str,
    customer_id: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """All orders attached to a customer — cash, qr, khata, draft, cancelled.
    Superset of /khata-history. Backs the customer-detail view so a manager
    can see the full activity for a repeat visitor, not just khata debts.

    `total_spent` sums closed (paid) orders only — draft/cancelled don't
    count toward lifetime value. `outstanding_balance` is the live khata
    balance (same value as /khata-history's balance field)."""
    _assert_branch_scope(staff, branch_id)
    tenant_id = staff["tenant_id"]
    customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
    if not customer or customer.branch_id != branch_id or not customer.is_active:
        return error_response("CUSTOMER_NOT_FOUND", "Customer not found.", 404)

    orders = CustomerRepository.list_all_orders(db, tenant_id, customer_id)
    # Paid/cancelled orders already have a snapshotted total_amount from
    # mark-paid time — use it as-is. Draft orders have none yet (still being
    # built), so compute a live preview from current branch VAT settings.
    vat_enabled, vat_rate = order_vat_settings(db, tenant_id, branch_id)
    entries = [
        CustomerOrderEntry(
            id=o.id,
            bill_number=o.bill_number,
            bill_code=o.bill_code,
            type=o.type,
            status=o.status,
            payment_method=o.payment_method,
            placed_at=o.placed_at,
            placed_at_bs=o.placed_at_bs,
            total=(
                Decimal(o.total_amount or 0)
                if o.status != "draft"
                else compute_order_total(o, vat_enabled, vat_rate)
            ),
            line_count=sum(1 for l in o.lines if not l.is_voided),
        )
        for o in orders
    ]
    total_spent = sum(
        (e.total for e in entries if e.status == "paid"), Decimal("0")
    )
    balance = OrderService.outstanding_balance(db, tenant_id, customer_id)
    payload = CustomerHistoryResponse(
        total_orders=len(entries),
        total_spent=total_spent,
        outstanding_balance=balance,
        orders=entries,
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


# ---------------------------------------------------------------------------
# Reports & dashboard — read-only aggregations. All money is serialized as
# strings (Decimal → str) to preserve precision; the frontend parses back to
# Number for display only.
# ---------------------------------------------------------------------------

_REPORTS_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "INVALID_RANGE": ("INVALID_RANGE", "bs_to must be >= bs_from.", 422),
    "INVALID_DATE": ("INVALID_DATE", "Date must be a valid BS YYYY-MM-DD string.", 422),
    "BS_CONVERSION_FAILED": (
        "BS_CONVERSION_FAILED",
        "Today's date is outside the BS calendar table — extend BS_CALENDAR.",
        500,
    ),
}


def _reports_error(code: str):
    mapped = _REPORTS_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to build report.", 500))
    return error_response(*mapped)


def _serialize_money(v) -> str:
    """Decimal → string. JSONResponse can't encode Decimal directly, and
    frontend billTotals-style code expects strings it can `Number()` back."""
    return str(v) if v is not None else "0"


def _serialize_summary(summary: dict) -> dict:
    return {
        "bs_from": summary["bs_from"],
        "bs_to": summary["bs_to"],
        "orders": summary["orders"],
        "items_sold": summary["items_sold"],
        "sales_gross": _serialize_money(summary["sales_gross"]),
        "expenses_total": _serialize_money(summary["expenses_total"]),
        "net": _serialize_money(summary["net"]),
        "by_category": [
            {
                "category": c["category"],
                "qty": c["qty"],
                "revenue": _serialize_money(c["revenue"]),
            }
            for c in summary["by_category"]
        ],
        "by_payment": {
            k: {"amount": _serialize_money(v["amount"]), "count": v["count"]}
            for k, v in summary["by_payment"].items()
        },
        "expenses_by_category": [
            {"category": c["category"], "amount": _serialize_money(c["amount"])}
            for c in summary["expenses_by_category"]
        ],
    }


def _serialize_top_items(items: list) -> list:
    return [
        {
            "name": i["name"],
            "variant_name": i["variant_name"],
            "qty": i["qty"],
            "revenue": _serialize_money(i["revenue"]),
        }
        for i in items
    ]


def _serialize_trend(trend: list) -> list:
    return [
        {
            "bs_date": r["bs_date"],
            "sales": _serialize_money(r["sales"]),
            "orders": r["orders"],
            "expenses": _serialize_money(r["expenses"]),
        }
        for r in trend
    ]


@router.get("/branches/{branch_id}/reports/dashboard")
def reports_dashboard(
    branch_id: str,
    bs: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """One-shot bundle for the RMS dashboard landing screen. `bs` defaults to
    today (server clock in NPT) — pass a BS date to view a historical day."""
    _assert_branch_scope(staff, branch_id)
    result = ReportsService.dashboard(db, staff["tenant_id"], branch_id, bs)
    if not result["success"]:
        return _reports_error(result["error_code"])
    d = result["dashboard"]
    return success_response(
        data={
            "anchor_bs": d["anchor_bs"],
            "today": _serialize_summary(d["today"]),
            "yesterday_sales": _serialize_money(d["yesterday_sales"]),
            "trend_7_days": _serialize_trend(d["trend_7_days"]),
            "top_items": _serialize_top_items(d["top_items"]),
            "tables": d["tables"],
            "low_stock_count": d["low_stock_count"],
        }
    )


@router.get("/branches/{branch_id}/reports/daily-summary")
def reports_daily_summary(
    branch_id: str,
    bs: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Single-BS-day P&L. `bs` is a "YYYY-MM-DD" BS date string."""
    _assert_branch_scope(staff, branch_id)
    result = ReportsService.daily_summary(db, staff["tenant_id"], branch_id, bs)
    if not result["success"]:
        return _reports_error(result["error_code"])
    return success_response(data=_serialize_summary(result["summary"]))


@router.get("/branches/{branch_id}/reports/range-summary")
def reports_range_summary(
    branch_id: str,
    bs_from: str,
    bs_to: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Multi-day P&L. Backs the ReportsView + DailySalesView (range mode)."""
    _assert_branch_scope(staff, branch_id)
    result = ReportsService.range_summary(db, staff["tenant_id"], branch_id, bs_from, bs_to)
    if not result["success"]:
        return _reports_error(result["error_code"])
    return success_response(data=_serialize_summary(result["summary"]))


@router.get("/branches/{branch_id}/reports/sales-trend")
def reports_sales_trend(
    branch_id: str,
    bs_from: str,
    bs_to: str,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Per-day rows for a line chart. Fills zero-days so the X-axis is
    continuous."""
    _assert_branch_scope(staff, branch_id)
    result = ReportsService.sales_trend(db, staff["tenant_id"], branch_id, bs_from, bs_to)
    if not result["success"]:
        return _reports_error(result["error_code"])
    return success_response(data=_serialize_trend(result["trend"]))


@router.get("/branches/{branch_id}/reports/top-items")
def reports_top_items(
    branch_id: str,
    bs_from: str | None = None,
    bs_to: str | None = None,
    limit: int = 10,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Ranked items list for the ReportsView items tab. Grouped by
    (name, variant_name) so different variants of the same item show
    separately."""
    _assert_branch_scope(staff, branch_id)
    result = ReportsService.top_items(
        db, staff["tenant_id"], branch_id, bs_from, bs_to, limit
    )
    if not result["success"]:
        return _reports_error(result["error_code"])
    return success_response(data=_serialize_top_items(result["items"]))


# ---------------------------------------------------------------------------
# Public (unauthenticated) — QR-menu page. Reachable by anyone with a branch
# UUID, which is what the printed QR resolves to. No tenant scope on the
# request itself since guests don't have accounts; branch lookup verifies
# active status and returns 404 otherwise.
# ---------------------------------------------------------------------------


def _restro_business_header_lines(tenant) -> list[str]:
    """Mirrors ims/router.py's _business_header_lines — same identity block
    every export prints at the top."""
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


def _restro_export_response(
    fmt: str,
    title: str,
    columns: list[str],
    rows: list[list],
    business_lines: list[str] | None = None,
    wide: bool = False,
):
    from utils.reports_export import build_xlsx, build_pdf
    from fastapi import Response as _Response

    if fmt not in ("xlsx", "pdf"):
        return error_response("INVALID_FORMAT", "format must be 'xlsx' or 'pdf'.", 422)
    if fmt == "xlsx":
        content = build_xlsx(title, columns, rows, business_lines)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ext = "xlsx"
    else:
        content = build_pdf(title, columns, rows, business_lines, wide=wide)
        media_type = "application/pdf"
        ext = "pdf"
    safe_title = title.lower().replace(" ", "-").encode("ascii", "ignore").decode("ascii") or "export"
    return _Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.{ext}"'},
    )


@router.get("/reports/sales-register/export")
def export_sales_register(
    format: str,
    branch_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """IRD Annexure-6 Sales Register (धिक्री खाता) — Date, Bill No, Buyer,
    PAN, Total/Taxable/VAT/Tax-exempt, and export columns (all '—' for
    domestic Nepal transactions)."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can export reports")
    if branch_id:
        _assert_branch_scope(staff, branch_id)
    from features.auth.repository import TenantRepository

    orders = OrderRepository.list_for_report(
        db, staff["tenant_id"], branch_id, bs_from, bs_to, include_credit_notes=False
    )
    columns = [
        "Date (BS)", "Bill No.", "Buyer", "Buyer PAN",
        "Total Amount", "Taxable Value", "VAT",
        "Tax-exempt Amount",
        "Export Value", "Export Country", "Export Customs No.", "Export Customs Date",
    ]
    rows = [
        [
            o.placed_at_bs, o.bill_number, o.buyer_name or "Walk-in", o.buyer_pan or "—",
            o.total_amount or Decimal("0"),
            o.taxable_amount or Decimal("0"),
            o.vat_amount or Decimal("0"),
            max(Decimal("0"), (o.total_amount or Decimal("0")) - (o.taxable_amount or Decimal("0")) - (o.vat_amount or Decimal("0"))),
            "—", "—", "—", "—",
        ]
        for o in orders
    ]
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _restro_export_response(format, "Sales Register", columns, rows, _restro_business_header_lines(tenant), wide=True)


@router.get("/reports/annexure-13/export")
def export_restro_annexure_13(
    format: str,
    branch_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """अनुसूची १३ (Annexure 13) — output VAT summary (RMS has no purchase
    side, so this is sales-only, unlike IMS's combined version). Standard
    structure; cross-check against IRD's exact template before submission."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can export reports")
    if branch_id:
        _assert_branch_scope(staff, branch_id)
    from features.auth.repository import TenantRepository

    orders = OrderRepository.list_for_report(db, staff["tenant_id"], branch_id, bs_from, bs_to)
    output_taxable = sum((Decimal(str(o.taxable_amount or 0)) for o in orders), Decimal("0"))
    output_vat = sum((Decimal(str(o.vat_amount or 0)) for o in orders), Decimal("0"))
    columns = ["Particulars", "Taxable Amount", "VAT Amount"]
    rows = [
        ["Output VAT (Sales)", output_taxable, output_vat],
        ["Net VAT Payable", output_taxable, output_vat],
    ]
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _restro_export_response(format, "Annexure 13", columns, rows, _restro_business_header_lines(tenant))


@router.get("/reports/monthly-vat-summary/export")
def export_restro_monthly_vat_summary(
    format: str,
    branch_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """मासिक (monthly) VAT summary — one row per BS month, sales-only (no
    purchase side in RMS). Standard structure; cross-check against IRD's
    exact template before submission."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can export reports")
    if branch_id:
        _assert_branch_scope(staff, branch_id)
    from features.auth.repository import TenantRepository

    orders = OrderRepository.list_for_report(db, staff["tenant_id"], branch_id, bs_from, bs_to)
    by_month: dict[str, dict[str, Decimal]] = {}
    for o in orders:
        month = o.placed_at_bs[:7] if o.placed_at_bs and len(o.placed_at_bs) >= 7 else "—"
        if month not in by_month:
            by_month[month] = {"taxable": Decimal("0"), "vat": Decimal("0")}
        by_month[month]["taxable"] += Decimal(str(o.taxable_amount or 0))
        by_month[month]["vat"] += Decimal(str(o.vat_amount or 0))
    columns = ["Month (BS)", "Sales Taxable", "Output VAT", "Net Payable"]
    rows = [
        [month, v["taxable"], v["vat"], v["vat"]]
        for month, v in sorted(by_month.items())
    ]
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _restro_export_response(format, "Monthly VAT Summary", columns, rows, _restro_business_header_lines(tenant))


@router.get("/reports/standard-view/export")
def export_restro_standard_view(
    format: str,
    branch_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Annex-5 Standard View — all 20 mandatory fields required by IRD's
    Electronic Billing Procedure 2082. Bills only (no credit notes)."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can export reports")
    if branch_id:
        _assert_branch_scope(staff, branch_id)
    from features.auth.repository import TenantRepository

    orders = OrderRepository.list_for_report(
        db, staff["tenant_id"], branch_id, bs_from, bs_to, include_credit_notes=False
    )
    columns = [
        "SN", "Bill No.", "Bill Code", "Date (BS)", "Fiscal Year",
        "Buyer Name", "Buyer PAN", "Seller PAN",
        "Total Sales", "Taxable (VAT)", "VAT",
        "Excisable Amt", "Excise",
        "Taxable (HST)", "HST",
        "Amt for ESF", "ESF",
        "Export Sales", "Tax Exempt",
        "Is Realtime", "VAT Refund", "Entered By",
    ]
    rows = [
        [
            idx,
            o.bill_number,
            o.bill_code or "",
            o.placed_at_bs or "",
            o.fiscal_year or "",
            o.buyer_name or "Walk-in",
            o.buyer_pan or "",
            o.seller_pan or "",
            o.total_amount or Decimal("0"),
            o.taxable_amount or Decimal("0"),
            o.vat_amount or Decimal("0"),
            # RMS has no excise/HST/ESF/export-sales concept — these Annex-5
            # columns are structurally N/A for a restaurant bill, not zero.
            "N/A", "N/A",
            "N/A", "N/A",
            "N/A", "N/A",
            "N/A",
            o.exempt_amount or Decimal("0"),
            "Yes" if o.is_realtime else "No",
            o.vat_refund_amount or Decimal("0"),
            o.entered_by_name or "",
        ]
        for idx, o in enumerate(orders, start=1)
    ]
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _restro_export_response(
        format, "Standard View (Annex-5)", columns, rows, _restro_business_header_lines(tenant), wide=True
    )


@router.get("/reports/credit-notes/export")
def export_restro_credit_notes(
    format: str,
    branch_id: str | None = None,
    bs_from: str | None = None,
    bs_to: str | None = None,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    """Credit Notes register — all paid credit notes in the period with their
    reference bill numbers. Required for IRD /api/billreturn reconciliation."""
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only owner or manager can export reports")
    if branch_id:
        _assert_branch_scope(staff, branch_id)
    from features.auth.repository import TenantRepository

    all_orders = OrderRepository.list_for_report(
        db, staff["tenant_id"], branch_id, bs_from, bs_to, include_credit_notes=True
    )
    credit_notes = [o for o in all_orders if o.is_credit_note]
    # Build a quick lookup so each credit note can show the original bill code.
    bill_lookup: dict[str, str] = {
        o.id: (o.bill_code or str(o.bill_number))
        for o in all_orders
        if not o.is_credit_note
    }
    columns = [
        "SN", "Credit Note No.", "Credit Note Code", "Date (BS)", "Fiscal Year",
        "Ref Bill", "Reason",
        "Total", "Taxable (VAT)", "VAT", "Tax Exempt",
    ]
    rows = [
        [
            idx,
            o.bill_number,
            o.bill_code or "",
            o.placed_at_bs or "",
            o.fiscal_year or "",
            bill_lookup.get(o.original_order_id or "", o.original_order_id or ""),
            o.note_reason or "",
            round(abs(float(o.total_amount or 0)), 2),
            round(abs(float(o.taxable_amount or 0)), 2),
            round(abs(float(o.vat_amount or 0)), 2),
            round(abs(float(o.exempt_amount or 0)), 2),
        ]
        for idx, o in enumerate(credit_notes, start=1)
    ]
    tenant = TenantRepository.get_by_id(db, staff["tenant_id"])
    return _restro_export_response(
        format, "Credit Notes Register", columns, rows, _restro_business_header_lines(tenant), wide=True
    )


# ---------------------------------------------------------------------------
# Audit log — IRD: Electronic Billing Procedure 2082, clause 6.3ग requires
# the User Activity Log be viewable/filterable via the front-end. Owner/
# Manager only (same gating as reports/CBMS sync) — front-line staff don't
# get to see who did what.
# ---------------------------------------------------------------------------


@router.get("/audit-log")
def list_restro_audit_log(
    entity_type: str | None = None,
    action: str | None = None,
    performed_by: str | None = None,
    q: str | None = None,
    page: int = 1,
    per_page: int = 25,
    staff: dict = Depends(require_restro_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("owner", "manager"):
        raise HTTPException(403, "Only Owner or Manager can view the activity log")
    paging = parse_paging(page, per_page)
    rows, total = AuditRepository.list_for_app(
        db,
        tenant_id=staff["tenant_id"],
        app_code="restro",
        entity_type=entity_type,
        action=action,
        performed_by=performed_by,
        q=q,
        offset=paging["offset"],
        limit=paging["limit"],
    )
    return success_response(
        data=[AuditLogEntryData.model_validate(r).model_dump(mode="json") for r in rows],
        meta=build_meta(total, paging["page"], paging["per_page"]),
    )


@router.get("/public/branches/{branch_id}/menu")
def public_menu(branch_id: str, db: Session = Depends(get_db)):
    result = get_public_menu(db, branch_id)
    if result is None:
        return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
    return success_response(data=result)
