from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime, date
from features.hotel_pms.roles import HotelPMSRole


class CredentialData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str | None
    role: str
    username: str
    created_by: str
    created_at: datetime
    updated_at: datetime


class CreateCredentialRequest(BaseModel):
    role: str
    username: str
    password: str
    branch_id: str | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in HotelPMSRole.values():
            raise ValueError(f"Invalid role. Must be one of: {HotelPMSRole.values()}")
        return v

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UpdateCredentialRequest(BaseModel):
    username: str | None = None
    password: str | None = None

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class StaffLoginRequest(BaseModel):
    username: str
    password: str


class StaffLoginResponse(BaseModel):
    token: str
    role: str
    tenant_id: str
    branch_id: str | None
    expires_at: datetime


class RoomTypeData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    name: str
    base_rate: Decimal
    capacity: int
    count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateRoomTypeRequest(BaseModel):
    name: str
    base_rate: Decimal
    capacity: int = 2
    count: int = 0

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name is required")
        return v

    @field_validator("base_rate")
    @classmethod
    def base_rate_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Base rate must be greater than 0")
        return v

    @field_validator("capacity")
    @classmethod
    def capacity_at_least_one(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Capacity must be at least 1")
        return v

    @field_validator("count")
    @classmethod
    def count_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Count cannot be negative")
        return v


class UpdateRoomTypeRequest(BaseModel):
    name: str | None = None
    base_rate: Decimal | None = None
    capacity: int | None = None
    count: int | None = None

    @field_validator("base_rate")
    @classmethod
    def base_rate_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("Base rate must be greater than 0")
        return v

    @field_validator("capacity")
    @classmethod
    def capacity_at_least_one(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("Capacity must be at least 1")
        return v

    @field_validator("count")
    @classmethod
    def count_non_negative(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("Count cannot be negative")
        return v


class RoomTypeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class RoomData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    room_type_id: str
    room_type: RoomTypeSummary | None = None
    room_number: str
    floor: str | None
    status: str
    rate_override: Decimal | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateRoomRequest(BaseModel):
    room_type_id: str
    room_number: str
    floor: str | None = None
    status: str = "available"
    rate_override: Decimal | None = None

    @field_validator("room_number")
    @classmethod
    def number_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Room number is required")
        return v


class UpdateRoomRequest(BaseModel):
    room_type_id: str | None = None
    room_number: str | None = None
    floor: str | None = None
    status: str | None = None
    rate_override: Decimal | None = None


class GuestData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    full_name: str
    phone: str | None
    email: str | None
    id_document_type: str | None
    id_document_number: str | None
    nationality: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateGuestRequest(BaseModel):
    full_name: str
    phone: str | None = None
    email: str | None = None
    id_document_type: str | None = None
    id_document_number: str | None = None
    nationality: str | None = None

    @field_validator("full_name")
    @classmethod
    def name_required(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Full name is required")
        return v


class UpdateGuestRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    email: str | None = None
    id_document_type: str | None = None
    id_document_number: str | None = None
    nationality: str | None = None


# -----------------------------------------------------------------------------
# Bookings
# -----------------------------------------------------------------------------

class GuestSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    phone: str | None
    email: str | None


class RoomSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    room_number: str
    floor: str | None


class BookingData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    branch_id: str
    room_id: str
    room: RoomSummary | None = None
    guest_id: str
    guest: GuestSummary | None = None
    check_in_date: date
    check_out_date: date
    actual_check_in: datetime | None
    actual_check_out: datetime | None
    status: str
    rate_per_night: Decimal
    num_guests: int
    notes: str | None
    created_by_cred_id: str | None
    created_at: datetime
    updated_at: datetime


class CreateBookingRequest(BaseModel):
    room_id: str
    guest_id: str
    check_in_date: date
    check_out_date: date
    num_guests: int = 1
    notes: str | None = None
    rate_per_night: Decimal | None = None

    @field_validator("num_guests")
    @classmethod
    def positive_guests(cls, v: int) -> int:
        if v < 1:
            raise ValueError("num_guests must be at least 1")
        return v


class UpdateBookingRequest(BaseModel):
    room_id: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    num_guests: int | None = None
    notes: str | None = None
    rate_per_night: Decimal | None = None
