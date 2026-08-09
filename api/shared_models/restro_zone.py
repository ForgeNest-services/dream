from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Index, text
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroZone(Base):
    """Floor / section within a branch (e.g. "Floor 1", "Rooftop", "Bar")."""

    __tablename__ = "restro_zones"
    __table_args__ = (
        Index(
            "uq_restro_zone_active_name",
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
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<RestroZone(branch_id={self.branch_id}, name={self.name})>"
