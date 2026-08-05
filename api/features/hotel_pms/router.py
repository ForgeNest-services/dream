from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, require_role, require_hotel_pms_staff
from utils.helpers import success_response, error_response
from features.hotel_pms.schemas import (
    CreateCredentialRequest,
    UpdateCredentialRequest,
    CredentialData,
    StaffLoginRequest,
    StaffLoginResponse,
    CreateBranchRequest,
    UpdateBranchRequest,
    BranchData,
)
from features.hotel_pms.service import (
    HotelPMSCredentialService,
    HotelPMSAuthService,
)
from features.hotel_pms.branch_service import HotelPMSBranchService


router = APIRouter(prefix="/hotel-pms", tags=["hotel-pms"])


# ---------------------------------------------------------------------------
# Staff-facing (public) - login from pms.dream.com
# ---------------------------------------------------------------------------

@router.post("/auth/login")
def staff_login(data: StaffLoginRequest, db: Session = Depends(get_db)):
    result = HotelPMSAuthService.login(db, data.username, data.password)

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
# Owner-facing (platform auth + hotel_pms subscription required)
# ---------------------------------------------------------------------------

owner_dep = [Depends(require_tenant_user)]


@router.get("/credentials", dependencies=owner_dep)
def list_credentials(
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    creds = HotelPMSCredentialService.list_for_tenant(db, user.tenant_id)
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
    result = HotelPMSCredentialService.create(
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
        if code == "BRANCH_REQUIRED":
            return error_response(
                "BRANCH_REQUIRED", f"Role '{data.role}' requires a branch.", 422
            )
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
    result = HotelPMSCredentialService.update(
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
    result = HotelPMSCredentialService.delete(db, tenant_id=user.tenant_id, cred_id=cred_id)

    if not result["success"]:
        return error_response("CREDENTIAL_NOT_FOUND", "Credential not found.", 404)

    return success_response(data={"deleted": True}, message="Credential removed")


# ---------------------------------------------------------------------------
# Branches (Owner-facing, platform auth)
# ---------------------------------------------------------------------------

@router.get("/branches", dependencies=owner_dep)
def list_branches(
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    branches = HotelPMSBranchService.list_for_tenant(db, user.tenant_id, user.tenant)
    return success_response(
        data=[BranchData.model_validate(b).model_dump(mode="json") for b in branches]
    )


@router.get("/branches/me")
def my_branches(
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    branches = HotelPMSBranchService.list_for_staff(
        db, staff["tenant_id"], staff["branch_id"]
    )
    return success_response(
        data=[BranchData.model_validate(b).model_dump(mode="json") for b in branches]
    )


@router.post("/branches", dependencies=owner_dep)
def create_branch(
    data: CreateBranchRequest,
    current_user: dict = Depends(require_role(["owner"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = HotelPMSBranchService.create(
        db,
        tenant_id=user.tenant_id,
        name=data.name,
        address=data.address,
        city=data.city,
        phone=data.phone,
    )
    return success_response(
        data=BranchData.model_validate(result["branch"]).model_dump(mode="json"),
        message="Branch created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}", dependencies=owner_dep)
def update_branch(
    branch_id: str,
    data: UpdateBranchRequest,
    current_user: dict = Depends(require_role(["owner"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = HotelPMSBranchService.update(
        db,
        tenant_id=user.tenant_id,
        branch_id=branch_id,
        name=data.name,
        address=data.address,
        city=data.city,
        phone=data.phone,
    )

    if not result["success"]:
        return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)

    return success_response(
        data=BranchData.model_validate(result["branch"]).model_dump(mode="json"),
        message="Branch updated",
    )


@router.delete("/branches/{branch_id}", dependencies=owner_dep)
def delete_branch(
    branch_id: str,
    current_user: dict = Depends(require_role(["owner"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = HotelPMSBranchService.delete(db, tenant_id=user.tenant_id, branch_id=branch_id)

    if not result["success"]:
        return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)

    return success_response(data={"deleted": True}, message="Branch removed")
