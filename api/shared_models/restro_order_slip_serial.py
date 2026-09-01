import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint
from core.database import Base


class RestroOrderSlipSerial(Base):
    """Gapless per-branch/fiscal-year Order Slip counter — a separate
    sequence from restro_invoice_serials' bill numbers. Electronic Billing
    Procedure 2082, clause 6.2(घ): a restaurant/hotel using Order Slips
    must keep the slip's own sequential number and log, distinct from the
    bill number it eventually feeds into.
    """

    __tablename__ = "restro_order_slip_serials"
    __table_args__ = (
        UniqueConstraint("branch_id", "fiscal_year",
                         name="uq_restro_order_slip_serial_branch_fy"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    fiscal_year = Column(String(10), nullable=False)
    last_number = Column(Integer, nullable=False, default=0)

    def __repr__(self):
        return f"<RestroOrderSlipSerial({self.branch_id}, {self.fiscal_year}, {self.last_number})>"
