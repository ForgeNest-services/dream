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
    CreateRoomTypeRequest,
    UpdateRoomTypeRequest,
    RoomTypeData,
)
from features.hotel_pms.service import (
    HotelPMSCredentialService,
    HotelPMSAuthService,
)
from features.hotel_pms.branch_service import HotelPMSBranchService
from features.hotel_pms.room_type_service import RoomTypeService


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


# ---------------------------------------------------------------------------
# Room Types (staff-facing — managed from PMS)
# ---------------------------------------------------------------------------

def _assert_branch_scope(staff: dict, branch_id: str) -> None:
    """Managers/front-desk can only touch their own branch. Owner spans all."""
    from fastapi import HTTPException
    if staff["role"] == "app_owner":
        return
    if staff.get("branch_id") != branch_id:
        raise HTTPException(403, "Not allowed for this branch")


@router.get("/branches/{branch_id}/room-types")
def list_room_types(
    branch_id: str,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = RoomTypeService.list_for_branch(db, staff["tenant_id"], branch_id)
    if not result["success"]:
        return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
    return success_response(
        data=[RoomTypeData.model_validate(rt).model_dump(mode="json") for rt in result["room_types"]]
    )


@router.post("/branches/{branch_id}/room-types")
def create_room_type(
    branch_id: str,
    data: CreateRoomTypeRequest,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("app_owner", "manager"):
        from fastapi import HTTPException
        raise HTTPException(403, "Only Owner or Manager can create room types")
    _assert_branch_scope(staff, branch_id)

    result = RoomTypeService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        name=data.name,
        base_rate=data.base_rate,
        capacity=data.capacity,
        count=data.count,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "BRANCH_NOT_FOUND":
            return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
        if code == "NAME_TAKEN":
            return error_response("NAME_TAKEN", "A room type with this name already exists in this branch.", 409)
        return error_response("CREATION_FAILED", "Failed to create room type.", 500)

    return success_response(
        data=RoomTypeData.model_validate(result["room_type"]).model_dump(mode="json"),
        message="Room type created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/room-types/{room_type_id}")
def update_room_type(
    branch_id: str,
    room_type_id: str,
    data: UpdateRoomTypeRequest,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("app_owner", "manager"):
        from fastapi import HTTPException
        raise HTTPException(403, "Only Owner or Manager can edit room types")
    _assert_branch_scope(staff, branch_id)

    result = RoomTypeService.update(
        db,
        tenant_id=staff["tenant_id"],
        room_type_id=room_type_id,
        name=data.name,
        base_rate=data.base_rate,
        capacity=data.capacity,
        count=data.count,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "ROOM_TYPE_NOT_FOUND":
            return error_response("ROOM_TYPE_NOT_FOUND", "Room type not found.", 404)
        if code == "NAME_TAKEN":
            return error_response("NAME_TAKEN", "A room type with this name already exists in this branch.", 409)
        return error_response("UPDATE_FAILED", "Failed to update room type.", 500)

    return success_response(
        data=RoomTypeData.model_validate(result["room_type"]).model_dump(mode="json"),
        message="Room type updated",
    )


@router.delete("/branches/{branch_id}/room-types/{room_type_id}")
def delete_room_type(
    branch_id: str,
    room_type_id: str,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] != "app_owner":
        from fastapi import HTTPException
        raise HTTPException(403, "Only Owner can delete room types")
    _assert_branch_scope(staff, branch_id)

    result = RoomTypeService.delete(db, tenant_id=staff["tenant_id"], room_type_id=room_type_id)
    if not result["success"]:
        return error_response("ROOM_TYPE_NOT_FOUND", "Room type not found.", 404)
    return success_response(data={"deleted": True}, message="Room type removed")
