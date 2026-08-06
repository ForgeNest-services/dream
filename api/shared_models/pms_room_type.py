from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, ForeignKey, Index, text
from datetime import datetime, timezone
import uuid
from core.database import Base


class PMSRoomType(Base):
    __tablename__ = "pms_room_types"
    __table_args__ = (
        Index(
            "uq_pms_room_type_active_name",
            "branch_id",
            "name",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    base_rate = Column(Numeric(10, 2), nullable=False)
    capacity = Column(Integer, nullable=False, default=2)
    count = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<PMSRoomType(branch_id={self.branch_id}, name={self.name})>"
