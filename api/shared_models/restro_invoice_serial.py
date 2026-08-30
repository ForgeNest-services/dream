import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint
from core.database import Base


class RestroInvoiceSerial(Base):
    """Gapless per-branch/fiscal-year bill number counter for Zestro orders.

    SELECT … FOR UPDATE in OrderRepository.next_bill_number prevents concurrent
    requests from picking the same number. Resets to 0 each fiscal year
    (IRD requirement: bill numbers restart at 1 at Shrawan 1).
    """

    __tablename__ = "restro_invoice_serials"
    __table_args__ = (
        UniqueConstraint("branch_id", "fiscal_year",
                         name="uq_restro_invoice_serial_branch_fy"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    fiscal_year = Column(String(10), nullable=False)  # e.g. "2081-82"
    last_number = Column(Integer, nullable=False, default=0)

    def __repr__(self):
        return f"<RestroInvoiceSerial({self.branch_id}, {self.fiscal_year}, {self.last_number})>"
