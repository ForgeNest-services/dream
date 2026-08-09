from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    text,
)
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroTable(Base):
    """A physical table inside a zone. `status` is one of empty/occupied/
    reserved. `merge_id` groups multiple physical tables into a single seated
    party (pushed together). Reservation fields are inline: at most one at a
    time, cleared when the guest arrives or cancels.
    """

    __tablename__ = "restro_tables"
    __table_args__ = (
        Index(
            "uq_restro_table_active_label",
            "zone_id",
            "label",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        Index("ix_restro_table_branch_status", "branch_id", "status"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    zone_id = Column(String(36), ForeignKey("public.restro_zones.id"), nullable=False, index=True)

    label = Column(String(50), nullable=False)  # e.g. "T1", "Bar 1"
    status = Column(String(20), nullable=False, default="empty")  # empty|occupied|reserved
    merge_id = Column(String(36), nullable=True, index=True)  # groups pushed-together tables

    # Reservation (inline, at most one at a time).
    reservation_guest_name = Column(String(150), nullable=True)
    reservation_phone = Column(String(30), nullable=True)
    reservation_date = Column(Date, nullable=True)
    reservation_time = Column(String(10), nullable=True)  # "HH:MM" 24h
    reservation_party_size = Column(Integer, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<RestroTable(zone_id={self.zone_id}, label={self.label}, status={self.status})>"
