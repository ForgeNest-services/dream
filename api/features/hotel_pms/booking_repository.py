from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import and_, not_, exists, or_, func
from sqlalchemy.orm import Session
from shared_models import PMSBooking, PMSRoom, PMSGuest

ACTIVE_BOOKING_STATUSES = ("reserved", "checked_in")


class BookingRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        room_id: str,
        guest_id: str,
        check_in_date: date,
        check_out_date: date,
        rate_per_night: Decimal,
        num_guests: int,
        notes: str | None,
        created_by_cred_id: str | None,
    ) -> PMSBooking:
        booking = PMSBooking(
            tenant_id=tenant_id,
            branch_id=branch_id,
            room_id=room_id,
            guest_id=guest_id,
            check_in_date=check_in_date,
            check_out_date=check_out_date,
            rate_per_night=rate_per_night,
            num_guests=num_guests,
            notes=notes.strip() if notes else None,
            created_by_cred_id=created_by_cred_id,
            status="reserved",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, booking_id: str) -> PMSBooking | None:
        return (
            db.query(PMSBooking)
            .filter(PMSBooking.id == booking_id, PMSBooking.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> list[PMSBooking]:
        return (
            db.query(PMSBooking)
            .filter(
                PMSBooking.tenant_id == tenant_id,
                PMSBooking.branch_id == branch_id,
            )
            .order_by(PMSBooking.check_in_date.desc())
            .all()
        )

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
    ) -> tuple[list[PMSBooking], int]:
        base = db.query(PMSBooking).filter(
            PMSBooking.tenant_id == tenant_id,
            PMSBooking.branch_id == branch_id,
        )
        if status:
            base = base.filter(PMSBooking.status == status)
        if room_id:
            base = base.filter(PMSBooking.room_id == room_id)
        if date_from:
            base = base.filter(PMSBooking.check_out_date >= date_from)
        if date_to:
            base = base.filter(PMSBooking.check_in_date <= date_to)
        if q:
            term = f"%{q.strip().lower()}%"
            base = (
                base.outerjoin(PMSGuest, PMSBooking.guest_id == PMSGuest.id)
                .outerjoin(PMSRoom, PMSBooking.room_id == PMSRoom.id)
                .filter(
                    or_(
                        func.lower(PMSGuest.full_name).like(term),
                        func.lower(PMSGuest.phone).like(term),
                        func.lower(PMSRoom.room_number).like(term),
                    )
                )
            )
        total = base.with_entities(func.count(PMSBooking.id)).scalar() or 0
        items = (
            base.order_by(PMSBooking.check_in_date.desc(), PMSBooking.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    @staticmethod
    def has_overlap(
        db: Session,
        room_id: str,
        check_in: date,
        check_out: date,
        exclude_booking_id: str | None = None,
    ) -> bool:
        """True if any active booking on this room overlaps with [check_in, check_out)."""
        q = db.query(PMSBooking).filter(
            PMSBooking.room_id == room_id,
            PMSBooking.status.in_(ACTIVE_BOOKING_STATUSES),
            PMSBooking.check_in_date < check_out,
            PMSBooking.check_out_date > check_in,
        )
        if exclude_booking_id:
            q = q.filter(PMSBooking.id != exclude_booking_id)
        return db.query(q.exists()).scalar()

    @staticmethod
    def available_rooms(
        db: Session,
        tenant_id: str,
        branch_id: str,
        check_in: date,
        check_out: date,
    ) -> list[PMSRoom]:
        """All active rooms in the branch that don't overlap with any active booking in the window."""
        overlap_subq = (
            db.query(PMSBooking.id)
            .filter(
                PMSBooking.room_id == PMSRoom.id,
                PMSBooking.status.in_(ACTIVE_BOOKING_STATUSES),
                PMSBooking.check_in_date < check_out,
                PMSBooking.check_out_date > check_in,
            )
        )
        return (
            db.query(PMSRoom)
            .filter(
                PMSRoom.tenant_id == tenant_id,
                PMSRoom.branch_id == branch_id,
                PMSRoom.is_active == True,
                not_(overlap_subq.exists()),
            )
            .order_by(PMSRoom.room_number)
            .all()
        )

    @staticmethod
    def update_dates_and_room(
        db: Session,
        booking: PMSBooking,
        room_id: str | None = None,
        check_in_date: date | None = None,
        check_out_date: date | None = None,
        num_guests: int | None = None,
        notes: str | None = None,
        rate_per_night: Decimal | None = None,
    ) -> PMSBooking:
        if room_id is not None:
            booking.room_id = room_id
        if check_in_date is not None:
            booking.check_in_date = check_in_date
        if check_out_date is not None:
            booking.check_out_date = check_out_date
        if num_guests is not None:
            booking.num_guests = num_guests
        if notes is not None:
            booking.notes = notes.strip() if notes else None
        if rate_per_night is not None:
            booking.rate_per_night = rate_per_night
        db.commit()
        db.refresh(booking)
        return booking

    @staticmethod
    def set_status(
        db: Session,
        booking: PMSBooking,
        status: str,
        actual_check_in: datetime | None = None,
        actual_check_out: datetime | None = None,
    ) -> PMSBooking:
        booking.status = status
        if actual_check_in is not None:
            booking.actual_check_in = actual_check_in
        if actual_check_out is not None:
            booking.actual_check_out = actual_check_out
        db.commit()
        db.refresh(booking)
        return booking
