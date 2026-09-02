from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from datetime import datetime, timezone
import uuid
from core.database import Base


class Branch(Base):
    """Physical business location, shared across all apps for a tenant.

    A tenant may run any combination of apps (Hotel PMS, Zestro Restaurant POS,
    Gym, etc.) at each branch. Downstream app-specific tables (pms_rooms,
    pms_bookings, future restro_tables, etc.) all FK into this table via
    branch_id.
    """

    __tablename__ = "branches"
    __table_args__ = (
        # IRD: Electronic Billing Procedure 2082, clause 6.2ग — once a
        # tenant issues bills from more than one location, each bill number
        # must carry a code/letter identifying which outlet issued it.
        # Unique per tenant (not globally — two different tenants can both
        # have a branch coded "KTM"), used in IMS/RMS's printed bill number.
        Index("uq_branch_tenant_code", "tenant_id", "code", unique=True),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(10), nullable=False)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<Branch(tenant_id={self.tenant_id}, name={self.name})>"
