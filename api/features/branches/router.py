from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, require_role, require_tenant_scope
from utils.helpers import success_response, error_response
from features.branches.schemas import (
    BranchData,
    CreateBranchRequest,
    UpdateBranchRequest,
    TenantInfoData,
)
from features.branches.service import BranchService
from features.auth.repository import TenantRepository


router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("")
def list_branches(
    scope: dict = Depends(require_tenant_scope),
    db: Session = Depends(get_db),
):
    """List branches for the current tenant. Works for both platform users
    (owner/manager via admin) and app staff (via pms/restro/ims tokens).
    Staff locked to a single branch see only that branch. Also returns the
    tenant's business identity (name/PAN/VAT status/contact) in `meta.tenant`
    — the only tenant-scoped fields any staff app can read, since staff
    tokens can't call the platform-only /auth/business-tax-info. Printed
    receipts (pms/restro/ims) read business info from here."""
    tenant = TenantRepository.get_by_id(db, scope["tenant_id"])
    if scope["source"] == "staff":
        branches = BranchService.list_for_staff(
            db, scope["tenant_id"], scope.get("branch_id")
        )
    else:
        branches = BranchService.list_for_tenant(db, scope["tenant_id"], tenant)
    return success_response(
        data=[BranchData.model_validate(b).model_dump(mode="json") for b in branches],
        meta={"tenant": TenantInfoData.model_validate(tenant).model_dump(mode="json")}
        if tenant
        else None,
    )


_BRANCH_ERROR_MAP = {
    "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
    "BRANCH_CODE_TAKEN": (
        "BRANCH_CODE_TAKEN",
        "Another branch already uses this code — pick a different one.",
        409,
    ),
}


def _branch_error(result: dict):
    code = result["error_code"]
    mapped = _BRANCH_ERROR_MAP.get(code, ("SERVER_ERROR", "Failed to process request.", 500))
    return error_response(*mapped)


@router.post("", dependencies=[Depends(require_tenant_user)])
def create_branch(
    data: CreateBranchRequest,
    current_user: dict = Depends(require_role(["owner"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = BranchService.create(
        db,
        tenant_id=user.tenant_id,
        name=data.name,
        code=data.code,
        address=data.address,
        city=data.city,
        phone=data.phone,
    )
    if not result["success"]:
        return _branch_error(result)
    return success_response(
        data=BranchData.model_validate(result["branch"]).model_dump(mode="json"),
        message="Branch created",
        status_code=201,
    )


@router.patch("/{branch_id}", dependencies=[Depends(require_tenant_user)])
def update_branch(
    branch_id: str,
    data: UpdateBranchRequest,
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = BranchService.update(
        db,
        tenant_id=user.tenant_id,
        branch_id=branch_id,
        name=data.name,
        code=data.code,
        address=data.address,
        city=data.city,
        phone=data.phone,
    )
    if not result["success"]:
        return _branch_error(result)
    return success_response(
        data=BranchData.model_validate(result["branch"]).model_dump(mode="json"),
        message="Branch updated",
    )


@router.delete("/{branch_id}", dependencies=[Depends(require_tenant_user)])
def delete_branch(
    branch_id: str,
    current_user: dict = Depends(require_role(["owner"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = BranchService.delete(db, tenant_id=user.tenant_id, branch_id=branch_id)
    if not result["success"]:
        return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
    return success_response(data={"deleted": True}, message="Branch removed")
