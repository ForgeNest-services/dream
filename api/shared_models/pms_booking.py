from sqlalchemy import (
    Column,
    String,
    Integer,
    Numeric,
    Boolean,
    DateTime,
    Date,
    Text,
    ForeignKey,
    CheckConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class PMSBooking(Base):
    __tablename__ = "pms_bookings"
    __table_args__ = (
        CheckConstraint(
            "check_out_date > check_in_date",
            name="ck_pms_booking_dates",
        ),
        Index("ix_pms_booking_room_dates", "room_id", "check_in_date", "check_out_date"),
        Index("ix_pms_booking_tenant_status", "tenant_id", "status"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    room_id = Column(String(36), ForeignKey("public.pms_rooms.id"), nullable=False)
    guest_id = Column(String(36), ForeignKey("public.pms_guests.id"), nullable=False)

    check_in_date = Column(Date, nullable=False)
    check_out_date = Column(Date, nullable=False)
    actual_check_in = Column(DateTime, nullable=True)
    actual_check_out = Column(DateTime, nullable=True)

    status = Column(String(20), nullable=False, default="reserved")
    rate_per_night = Column(Numeric(10, 2), nullable=False)
    num_guests = Column(Integer, nullable=False, default=1)
    notes = Column(Text, nullable=True)

    created_by_cred_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    room = relationship("PMSRoom", lazy="joined")
    guest = relationship("PMSGuest", lazy="joined")

    def __repr__(self):
        return f"<PMSBooking(room_id={self.room_id}, {self.check_in_date}→{self.check_out_date}, {self.status})>"
