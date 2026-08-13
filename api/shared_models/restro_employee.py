from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroEmployee(Base):
    """Branch-scoped staff directory — separate from login credentials.
    A credential is a shared role login (one Waiter cred used by every waiter
    on shift); an Employee is a specific human with salary + shift + phone.
    Someone can exist as an Employee without a login (e.g. a dishwasher who
    doesn't touch the POS), and multiple employees share one credential."""

    __tablename__ = "restro_employees"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    designation = Column(String(100), nullable=False, default="Waiter")
    phone = Column(String(20), nullable=False, default="")
    email = Column(String(255), nullable=True)
    # Numeric so tenants using paisa/decimals aren't forced into rounding.
    salary = Column(Numeric(12, 2), nullable=False, default=0)
    # Free-form ("11:00 AM - 9:00 PM"). If we ever want shift analytics we
    # split this into start/end columns — for now the UI treats it as a label.
    shift = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<RestroEmployee(branch_id={self.branch_id}, name={self.name})>"
