from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, Numeric, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class PMSRoom(Base):
    __tablename__ = "pms_rooms"
    __table_args__ = (
        Index(
            "uq_pms_room_active_number",
            "branch_id",
            "room_number",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.hotel_pms_branches.id"), nullable=False, index=True)
    room_type_id = Column(String(36), ForeignKey("public.pms_room_types.id"), nullable=False, index=True)
    room_number = Column(String(20), nullable=False)
    floor = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="available")
    rate_override = Column(Numeric(10, 2), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    room_type = relationship("PMSRoomType", lazy="joined")

    def __repr__(self):
        return f"<PMSRoom(branch_id={self.branch_id}, number={self.room_number})>"
