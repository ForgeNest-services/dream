"""Per-branch, per-fiscal-year invoice serial counter.

One row per (branch_id, fiscal_year, series).  The `last_number` column is
incremented inside a SELECT … FOR UPDATE transaction so the sequence is
gapless and monotonically increasing — as required by IRD.

series values:
  'INV'  regular tax invoices
  'CN'   credit notes
  'DN'   debit notes
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint
from core.database import Base


class PMSInvoiceSerial(Base):
    __tablename__ = "pms_invoice_serials"
    __table_args__ = (
        UniqueConstraint("branch_id", "fiscal_year", "series",
                         name="uq_pms_invoice_serial_branch_fy_series"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id = Column(String(36), ForeignKey("public.branches.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    fiscal_year = Column(String(10), nullable=False)   # "2081-82"
    series = Column(String(10), nullable=False, default="INV")
    last_number = Column(Integer, nullable=False, default=0)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
