from sqlalchemy import Column, String, DateTime, ForeignKey
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSCredential(Base):
    """Staff login for IMS. owner is tenant-wide (branch_id=NULL, sees every
    branch); manager/storekeeper/cashier/accountant are branch-scoped —
    multiple people can share a role at the same branch (e.g. two cashiers).
    `username` is globally unique and used only for login. `name` is the
    display name shown on printed bills and the activity log — IRD Annex-5's
    Entered_By/Printed_By."""

    __tablename__ = "ims_credentials"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=True, index=True)
    role = Column(String(50), nullable=False)
    # Display name for bills/receipts — not globally unique; two people named
    # "Ramesh" are fine. Shown as "Entered by" on printed bills.
    name = Column(String(100), nullable=False)
    email = Column(String(200), nullable=True)
    phone = Column(String(30), nullable=True)
    username = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_by = Column(String(36), ForeignKey("public.users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<IMSCredential(tenant_id={self.tenant_id}, branch_id={self.branch_id}, role={self.role})>"
