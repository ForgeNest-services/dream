from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, require_role, require_hotel_pms_staff
from utils.helpers import success_response, error_response
from utils.paging import parse_paging, build_meta
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
    CreateRoomRequest,
    UpdateRoomRequest,
    RoomData,
    CreateGuestRequest,
    UpdateGuestRequest,
    GuestData,
    CreateBookingRequest,
    UpdateBookingRequest,
    BookingData,
)
from features.hotel_pms.service import (
    HotelPMSCredentialService,
    HotelPMSAuthService,
)
from features.hotel_pms.branch_service import HotelPMSBranchService
from features.hotel_pms.room_type_service import RoomTypeService
from features.hotel_pms.room_service import RoomService
from features.hotel_pms.guest_service import GuestService
from features.hotel_pms.booking_service import BookingService


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


# ---------------------------------------------------------------------------
# Rooms (staff-facing — managed from PMS)
# ---------------------------------------------------------------------------

@router.get("/branches/{branch_id}/rooms")
def list_rooms(
    branch_id: str,
    q: str | None = Query(None),
    type: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    paging = parse_paging(page, per_page)
    result = RoomService.list_paginated(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        q=q,
        room_type_id=type,
        status=status,
        offset=paging["offset"],
        limit=paging["limit"],
    )
    if not result["success"]:
        return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
    return success_response(
        data=[RoomData.model_validate(r).model_dump(mode="json") for r in result["rooms"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.post("/branches/{branch_id}/rooms")
def create_room(
    branch_id: str,
    data: CreateRoomRequest,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("app_owner", "manager"):
        from fastapi import HTTPException
        raise HTTPException(403, "Only Owner or Manager can create rooms")
    _assert_branch_scope(staff, branch_id)

    result = RoomService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        room_type_id=data.room_type_id,
        room_number=data.room_number,
        floor=data.floor,
        status=data.status,
        rate_override=data.rate_override,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "BRANCH_NOT_FOUND":
            return error_response("BRANCH_NOT_FOUND", "Branch not found.", 404)
        if code == "ROOM_TYPE_NOT_FOUND":
            return error_response("ROOM_TYPE_NOT_FOUND", "Room type not found in this branch.", 404)
        if code == "INVALID_STATUS":
            return error_response("INVALID_STATUS", "Invalid status value.", 400)
        if code == "INVALID_RATE":
            return error_response("INVALID_RATE", "Rate must be greater than 0.", 400)
        if code == "ROOM_NUMBER_TAKEN":
            return error_response("ROOM_NUMBER_TAKEN", "A room with this number already exists in this branch.", 409)
        return error_response("CREATION_FAILED", "Failed to create room.", 500)

    return success_response(
        data=RoomData.model_validate(result["room"]).model_dump(mode="json"),
        message="Room created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/rooms/{room_id}")
def update_room(
    branch_id: str,
    room_id: str,
    data: UpdateRoomRequest,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] not in ("app_owner", "manager"):
        from fastapi import HTTPException
        raise HTTPException(403, "Only Owner or Manager can edit rooms")
    _assert_branch_scope(staff, branch_id)

    payload = data.model_dump(exclude_unset=True)
    kwargs = {
        "tenant_id": staff["tenant_id"],
        "branch_id": branch_id,
        "room_id": room_id,
    }
    for key in ("room_type_id", "room_number", "floor", "status", "rate_override"):
        if key in payload:
            kwargs[key] = payload[key]

    result = RoomService.update(db, **kwargs)

    if not result["success"]:
        code = result["error_code"]
        if code == "ROOM_NOT_FOUND":
            return error_response("ROOM_NOT_FOUND", "Room not found.", 404)
        if code == "ROOM_TYPE_NOT_FOUND":
            return error_response("ROOM_TYPE_NOT_FOUND", "Room type not found in this branch.", 404)
        if code == "INVALID_STATUS":
            return error_response("INVALID_STATUS", "Invalid status value.", 400)
        if code == "INVALID_RATE":
            return error_response("INVALID_RATE", "Rate must be greater than 0.", 400)
        if code == "ROOM_NUMBER_TAKEN":
            return error_response("ROOM_NUMBER_TAKEN", "A room with this number already exists in this branch.", 409)
        return error_response("UPDATE_FAILED", "Failed to update room.", 500)

    return success_response(
        data=RoomData.model_validate(result["room"]).model_dump(mode="json"),
        message="Room updated",
    )


@router.delete("/branches/{branch_id}/rooms/{room_id}")
def delete_room(
    branch_id: str,
    room_id: str,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] != "app_owner":
        from fastapi import HTTPException
        raise HTTPException(403, "Only Owner can delete rooms")
    _assert_branch_scope(staff, branch_id)

    result = RoomService.delete(db, tenant_id=staff["tenant_id"], branch_id=branch_id, room_id=room_id)
    if not result["success"]:
        return error_response("ROOM_NOT_FOUND", "Room not found.", 404)
    return success_response(data={"deleted": True}, message="Room removed")


# ---------------------------------------------------------------------------
# Guests (staff-facing — tenant-scoped, no branch check)
# ---------------------------------------------------------------------------

@router.get("/guests")
def list_guests(
    q: str | None = Query(None),
    doc_type: str | None = Query(None),
    nationality: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    paging = parse_paging(page, per_page)
    result = GuestService.list_paginated(
        db,
        tenant_id=staff["tenant_id"],
        q=q,
        doc_type=doc_type,
        nationality=nationality,
        offset=paging["offset"],
        limit=paging["limit"],
    )
    return success_response(
        data=[GuestData.model_validate(g).model_dump(mode="json") for g in result["guests"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.post("/guests")
def create_guest(
    data: CreateGuestRequest,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    result = GuestService.create(
        db,
        tenant_id=staff["tenant_id"],
        full_name=data.full_name,
        phone=data.phone,
        email=data.email,
        id_document_type=data.id_document_type,
        id_document_number=data.id_document_number,
        nationality=data.nationality,
    )

    if not result["success"]:
        return error_response("CREATION_FAILED", "Failed to create guest.", 500)

    return success_response(
        data=GuestData.model_validate(result["guest"]).model_dump(mode="json"),
        message="Guest created",
        status_code=201,
    )


@router.patch("/guests/{guest_id}")
def update_guest(
    guest_id: str,
    data: UpdateGuestRequest,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    result = GuestService.update(
        db,
        tenant_id=staff["tenant_id"],
        guest_id=guest_id,
        full_name=data.full_name,
        phone=data.phone,
        email=data.email,
        id_document_type=data.id_document_type,
        id_document_number=data.id_document_number,
        nationality=data.nationality,
    )

    if not result["success"]:
        code = result["error_code"]
        if code == "GUEST_NOT_FOUND":
            return error_response("GUEST_NOT_FOUND", "Guest not found.", 404)
        return error_response("UPDATE_FAILED", "Failed to update guest.", 500)

    return success_response(
        data=GuestData.model_validate(result["guest"]).model_dump(mode="json"),
        message="Guest updated",
    )


@router.delete("/guests/{guest_id}")
def delete_guest(
    guest_id: str,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    if staff["role"] != "app_owner":
        from fastapi import HTTPException
        raise HTTPException(403, "Only Owner can remove guests")

    result = GuestService.delete(db, tenant_id=staff["tenant_id"], guest_id=guest_id)
    if not result["success"]:
        return error_response("GUEST_NOT_FOUND", "Guest not found.", 404)
    return success_response(data={"deleted": True}, message="Guest removed")


# ---------------------------------------------------------------------------
# Bookings (staff-facing, branch-scoped)
# ---------------------------------------------------------------------------


def _booking_error(code: str):
    """Map booking service error codes to HTTP responses."""
    mapping = {
        "BRANCH_NOT_FOUND": ("BRANCH_NOT_FOUND", "Branch not found.", 404),
        "ROOM_NOT_FOUND": ("ROOM_NOT_FOUND", "Room not found in this branch.", 404),
        "GUEST_NOT_FOUND": ("GUEST_NOT_FOUND", "Guest not found.", 404),
        "BOOKING_NOT_FOUND": ("BOOKING_NOT_FOUND", "Booking not found.", 404),
        "ROOM_UNAVAILABLE": (
            "ROOM_UNAVAILABLE",
            "This room already has an overlapping booking for those dates.",
            409,
        ),
        "INVALID_DATES": ("INVALID_DATES", "Check-out must be after check-in.", 400),
        "INVALID_GUEST_COUNT": ("INVALID_GUEST_COUNT", "Guest count must be at least 1.", 400),
        "INVALID_RATE": ("INVALID_RATE", "Rate must be greater than 0.", 400),
        "NOT_EDITABLE": (
            "NOT_EDITABLE",
            "Only reserved bookings can be edited. Check-in first or cancel to change.",
            409,
        ),
        "INVALID_TRANSITION": (
            "INVALID_TRANSITION",
            "This action isn't allowed for the booking's current status.",
            409,
        ),
        "CREATION_FAILED": ("CREATION_FAILED", "Failed to create booking.", 500),
        "UPDATE_FAILED": ("UPDATE_FAILED", "Failed to update booking.", 500),
    }
    entry = mapping.get(code)
    if not entry:
        return error_response("UNKNOWN_ERROR", "Something went wrong.", 500)
    c, m, s = entry
    return error_response(c, m, s)


@router.get("/branches/{branch_id}/bookings")
def list_bookings(
    branch_id: str,
    q: str | None = Query(None),
    status: str | None = Query(None),
    room_id: str | None = Query(None),
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    paging = parse_paging(page, per_page)
    result = BookingService.list_paginated(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        q=q,
        status=status,
        room_id=room_id,
        date_from=date_from,
        date_to=date_to,
        offset=paging["offset"],
        limit=paging["limit"],
    )
    if not result["success"]:
        return _booking_error(result["error_code"])
    return success_response(
        data=[BookingData.model_validate(b).model_dump(mode="json") for b in result["bookings"]],
        meta=build_meta(result["total"], paging["page"], paging["per_page"]),
    )


@router.get("/branches/{branch_id}/bookings/availability")
def bookings_availability(
    branch_id: str,
    check_in: date = Query(..., description="YYYY-MM-DD"),
    check_out: date = Query(..., description="YYYY-MM-DD"),
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = BookingService.available_rooms(
        db, staff["tenant_id"], branch_id, check_in, check_out
    )
    if not result["success"]:
        return _booking_error(result["error_code"])
    return success_response(
        data=[RoomData.model_validate(r).model_dump(mode="json") for r in result["rooms"]]
    )


@router.post("/branches/{branch_id}/bookings")
def create_booking(
    branch_id: str,
    data: CreateBookingRequest,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = BookingService.create(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        room_id=data.room_id,
        guest_id=data.guest_id,
        check_in_date=data.check_in_date,
        check_out_date=data.check_out_date,
        num_guests=data.num_guests,
        notes=data.notes,
        created_by_cred_id=staff.get("cred_id"),
        rate_per_night=data.rate_per_night,
    )
    if not result["success"]:
        return _booking_error(result["error_code"])
    return success_response(
        data=BookingData.model_validate(result["booking"]).model_dump(mode="json"),
        message="Booking created",
        status_code=201,
    )


@router.patch("/branches/{branch_id}/bookings/{booking_id}")
def update_booking(
    branch_id: str,
    booking_id: str,
    data: UpdateBookingRequest,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    payload = data.model_dump(exclude_unset=True)
    result = BookingService.update(
        db,
        tenant_id=staff["tenant_id"],
        branch_id=branch_id,
        booking_id=booking_id,
        **payload,
    )
    if not result["success"]:
        return _booking_error(result["error_code"])
    return success_response(
        data=BookingData.model_validate(result["booking"]).model_dump(mode="json"),
        message="Booking updated",
    )


@router.post("/branches/{branch_id}/bookings/{booking_id}/check-in")
def booking_check_in(
    branch_id: str,
    booking_id: str,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = BookingService.check_in(db, staff["tenant_id"], branch_id, booking_id)
    if not result["success"]:
        return _booking_error(result["error_code"])
    return success_response(
        data=BookingData.model_validate(result["booking"]).model_dump(mode="json"),
        message="Guest checked in",
    )


@router.post("/branches/{branch_id}/bookings/{booking_id}/check-out")
def booking_check_out(
    branch_id: str,
    booking_id: str,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = BookingService.check_out(db, staff["tenant_id"], branch_id, booking_id)
    if not result["success"]:
        return _booking_error(result["error_code"])
    return success_response(
        data=BookingData.model_validate(result["booking"]).model_dump(mode="json"),
        message="Guest checked out",
    )


@router.post("/branches/{branch_id}/bookings/{booking_id}/cancel")
def booking_cancel(
    branch_id: str,
    booking_id: str,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = BookingService.cancel(db, staff["tenant_id"], branch_id, booking_id)
    if not result["success"]:
        return _booking_error(result["error_code"])
    return success_response(
        data=BookingData.model_validate(result["booking"]).model_dump(mode="json"),
        message="Booking cancelled",
    )


@router.post("/branches/{branch_id}/bookings/{booking_id}/no-show")
def booking_no_show(
    branch_id: str,
    booking_id: str,
    staff: dict = Depends(require_hotel_pms_staff()),
    db: Session = Depends(get_db),
):
    _assert_branch_scope(staff, branch_id)
    result = BookingService.mark_no_show(db, staff["tenant_id"], branch_id, booking_id)
    if not result["success"]:
        return _booking_error(result["error_code"])
    return success_response(
        data=BookingData.model_validate(result["booking"]).model_dump(mode="json"),
        message="Booking marked as no-show",
    )
