from decimal import Decimal
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from features.hotel_pms.booking_repository import BookingRepository
from features.hotel_pms.room_repository import RoomRepository
from features.hotel_pms.guest_repository import GuestRepository
from features.hotel_pms.branch_repository import HotelPMSBranchRepository
from utils.logger import logger


ALLOWED_STATUSES = {"reserved", "checked_in", "checked_out", "cancelled", "no_show"}


def _effective_room_rate(room) -> Decimal:
    if room.rate_override is not None:
        return Decimal(room.rate_override)
    if room.room_type is not None:
        return Decimal(room.room_type.base_rate)
    return Decimal(0)


class BookingService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return HotelPMSBranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> dict:
        if not BookingService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        bookings = BookingRepository.list_for_branch(db, tenant_id, branch_id)
        return {"success": True, "bookings": bookings}

    @staticmethod
    def list_paginated(
        db: Session,
        tenant_id: str,
        branch_id: str,
        q: str | None,
        status: str | None,
        room_id: str | None,
        date_from: date | None,
        date_to: date | None,
        offset: int,
        limit: int,
    ) -> dict:
        if not BookingService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        items, total = BookingRepository.list_paginated(
            db,
            tenant_id=tenant_id,
            branch_id=branch_id,
            q=q,
            status=status,
            room_id=room_id,
            date_from=date_from,
            date_to=date_to,
            offset=offset,
            limit=limit,
        )
        return {"success": True, "bookings": items, "total": total}

    @staticmethod
    def available_rooms(
        db: Session,
        tenant_id: str,
        branch_id: str,
        check_in: date,
        check_out: date,
    ) -> dict:
        if not BookingService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if check_out <= check_in:
            return {"success": False, "error_code": "INVALID_DATES"}
        rooms = BookingRepository.available_rooms(db, tenant_id, branch_id, check_in, check_out)
        return {"success": True, "rooms": rooms}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        room_id: str,
        guest_id: str,
        check_in_date: date,
        check_out_date: date,
        num_guests: int,
        notes: str | None,
        created_by_cred_id: str | None,
        rate_per_night: Decimal | None = None,
    ) -> dict:
        if not BookingService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        if check_out_date <= check_in_date:
            return {"success": False, "error_code": "INVALID_DATES"}

        if num_guests < 1:
            return {"success": False, "error_code": "INVALID_GUEST_COUNT"}

        room = RoomRepository.get_by_id(db, tenant_id, room_id)
        if not room or room.branch_id != branch_id or not room.is_active:
            return {"success": False, "error_code": "ROOM_NOT_FOUND"}

        guest = GuestRepository.get_by_id(db, tenant_id, guest_id)
        if not guest or not guest.is_active:
            return {"success": False, "error_code": "GUEST_NOT_FOUND"}

        if BookingRepository.has_overlap(db, room_id, check_in_date, check_out_date):
            return {"success": False, "error_code": "ROOM_UNAVAILABLE"}

        effective_rate = (
            Decimal(rate_per_night) if rate_per_night is not None else _effective_room_rate(room)
        )
        if effective_rate <= 0:
            return {"success": False, "error_code": "INVALID_RATE"}

        try:
            booking = BookingRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                room_id=room_id,
                guest_id=guest_id,
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                rate_per_night=effective_rate,
                num_guests=num_guests,
                notes=notes,
                created_by_cred_id=created_by_cred_id,
            )
            logger.info(
                f"Booking created: {booking.id}",
                extra={
                    "tenant_id": tenant_id,
                    "branch_id": branch_id,
                    "room_id": room_id,
                    "guest_id": guest_id,
                    "dates": f"{check_in_date}->{check_out_date}",
                },
            )
            return {"success": True, "booking": booking}
        except Exception as e:
            db.rollback()
            logger.error(f"Booking creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        booking_id: str,
        room_id: str | None = None,
        check_in_date: date | None = None,
        check_out_date: date | None = None,
        num_guests: int | None = None,
        notes: str | None = None,
        rate_per_night: Decimal | None = None,
    ) -> dict:
        booking = BookingRepository.get_by_id(db, tenant_id, booking_id)
        if not booking or booking.branch_id != branch_id:
            return {"success": False, "error_code": "BOOKING_NOT_FOUND"}

        if booking.status != "reserved":
            return {"success": False, "error_code": "NOT_EDITABLE"}

        new_room_id = room_id or booking.room_id
        new_check_in = check_in_date or booking.check_in_date
        new_check_out = check_out_date or booking.check_out_date

        if new_check_out <= new_check_in:
            return {"success": False, "error_code": "INVALID_DATES"}

        if room_id is not None:
            room = RoomRepository.get_by_id(db, tenant_id, room_id)
            if not room or room.branch_id != branch_id or not room.is_active:
                return {"success": False, "error_code": "ROOM_NOT_FOUND"}

        if num_guests is not None and num_guests < 1:
            return {"success": False, "error_code": "INVALID_GUEST_COUNT"}

        if rate_per_night is not None and rate_per_night <= 0:
            return {"success": False, "error_code": "INVALID_RATE"}

        if BookingRepository.has_overlap(
            db, new_room_id, new_check_in, new_check_out, exclude_booking_id=booking_id
        ):
            return {"success": False, "error_code": "ROOM_UNAVAILABLE"}

        try:
            updated = BookingRepository.update_dates_and_room(
                db,
                booking,
                room_id=room_id,
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                num_guests=num_guests,
                notes=notes,
                rate_per_night=rate_per_night,
            )
            return {"success": True, "booking": updated}
        except Exception as e:
            db.rollback()
            logger.error(f"Booking update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def check_in(db: Session, tenant_id: str, branch_id: str, booking_id: str) -> dict:
        booking = BookingRepository.get_by_id(db, tenant_id, booking_id)
        if not booking or booking.branch_id != branch_id:
            return {"success": False, "error_code": "BOOKING_NOT_FOUND"}
        if booking.status != "reserved":
            return {"success": False, "error_code": "INVALID_TRANSITION"}

        room = RoomRepository.get_by_id(db, tenant_id, booking.room_id)
        BookingRepository.set_status(
            db, booking, status="checked_in", actual_check_in=datetime.now(timezone.utc)
        )
        if room:
            RoomRepository.update(db, room, status="occupied")

        logger.info(f"Booking checked in: {booking_id}")
        return {"success": True, "booking": booking}

    @staticmethod
    def check_out(db: Session, tenant_id: str, branch_id: str, booking_id: str) -> dict:
        booking = BookingRepository.get_by_id(db, tenant_id, booking_id)
        if not booking or booking.branch_id != branch_id:
            return {"success": False, "error_code": "BOOKING_NOT_FOUND"}
        if booking.status != "checked_in":
            return {"success": False, "error_code": "INVALID_TRANSITION"}

        room = RoomRepository.get_by_id(db, tenant_id, booking.room_id)
        BookingRepository.set_status(
            db, booking, status="checked_out", actual_check_out=datetime.now(timezone.utc)
        )
        if room:
            RoomRepository.update(db, room, status="cleaning")

        logger.info(f"Booking checked out: {booking_id}")
        return {"success": True, "booking": booking}

    @staticmethod
    def cancel(db: Session, tenant_id: str, branch_id: str, booking_id: str) -> dict:
        booking = BookingRepository.get_by_id(db, tenant_id, booking_id)
        if not booking or booking.branch_id != branch_id:
            return {"success": False, "error_code": "BOOKING_NOT_FOUND"}
        if booking.status not in ("reserved", "checked_in"):
            return {"success": False, "error_code": "INVALID_TRANSITION"}

        BookingRepository.set_status(db, booking, status="cancelled")
        logger.info(f"Booking cancelled: {booking_id}")
        return {"success": True, "booking": booking}

    @staticmethod
    def mark_no_show(db: Session, tenant_id: str, branch_id: str, booking_id: str) -> dict:
        booking = BookingRepository.get_by_id(db, tenant_id, booking_id)
        if not booking or booking.branch_id != branch_id:
            return {"success": False, "error_code": "BOOKING_NOT_FOUND"}
        if booking.status != "reserved":
            return {"success": False, "error_code": "INVALID_TRANSITION"}

        BookingRepository.set_status(db, booking, status="no_show")
        logger.info(f"Booking marked no-show: {booking_id}")
        return {"success": True, "booking": booking}
