import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint
from core.database import Base


class IMSInvoiceSerial(Base):
    """Gapless per-branch/fiscal-year/series serial counter for IMS invoices.

    SELECT … FOR UPDATE is used in IMSInvoiceRepository.next_serial to prevent
    concurrent requests from picking the same number (same pattern as PMSInvoiceSerial).
    series: 'INV' | 'CN' | 'QT'
    """

    __tablename__ = "ims_invoice_serials"
    __table_args__ = (
        UniqueConstraint("branch_id", "fiscal_year", "series",
                         name="uq_ims_invoice_serial_branch_fy_series"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    fiscal_year = Column(String(10), nullable=False)   # e.g. "2081-82"
    series = Column(String(10), nullable=False)        # INV | CN | QT
    last_number = Column(Integer, nullable=False, default=0)

    def __repr__(self):
        return f"<IMSInvoiceSerial({self.branch_id}, {self.fiscal_year}, {self.series}, {self.last_number})>"
