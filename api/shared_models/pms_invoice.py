"""IRD-compliant invoice model for Hotel PMS.

Design rules (Electronic Billing Procedure 2074):
  - Append-only: no updated_at column; no UPDATE/DELETE grants in production.
  - Seller & buyer info snapshot at issue time — historical records are immutable.
  - Reprint produces a new row, not a mutation of the original.
  - Credit / debit notes get own serial sequences (series='CN'/'DN').
  - UNIQUE(branch_id, invoice_number) enforces gapless per-branch numbering.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Numeric, Text, DateTime,
    ForeignKey, UniqueConstraint, CheckConstraint, JSON, Integer,
)
from core.database import Base


class PMSInvoice(Base):
    __tablename__ = "pms_invoices"
    __table_args__ = (
        UniqueConstraint("branch_id", "invoice_number",
                         name="uq_pms_invoice_branch_number"),
        CheckConstraint(
            "status IN ('issued','cancelled')",
            name="ck_pms_invoice_status",
        ),
        CheckConstraint(
            "series IN ('INV','CN','DN')",
            name="ck_pms_invoice_series",
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    booking_id = Column(String(36), ForeignKey("public.pms_bookings.id"), nullable=True, index=True)

    # ── Serial / fiscal ──────────────────────────────────────────────────────
    series = Column(String(10), nullable=False, default="INV")  # INV | CN | DN
    invoice_number = Column(String(50), nullable=False)          # e.g. INV-81/82-00001
    fiscal_year = Column(String(10), nullable=False)             # e.g. 2081-82
    serial_number = Column(Integer, nullable=False)              # raw integer for easy sorting

    # ── Seller snapshot (tenant at time of issue) ────────────────────────────
    seller_name = Column(String(255), nullable=False)
    seller_address = Column(Text, nullable=True)
    seller_pan = Column(String(50), nullable=True)
    seller_is_vat_registered = Column(Boolean, nullable=False, default=False)

    # ── Buyer snapshot (guest at time of issue) ──────────────────────────────
    buyer_name = Column(String(255), nullable=False)
    buyer_pan = Column(String(50), nullable=True)    # mandatory for B2B VAT bills
    buyer_address = Column(Text, nullable=True)

    # ── Amounts ──────────────────────────────────────────────────────────────
    subtotal_amount = Column(Numeric(12, 2), nullable=False)     # non-taxable / tax-exempt
    taxable_amount = Column(Numeric(12, 2), nullable=False, default=0)
    vat_amount = Column(Numeric(12, 2), nullable=False, default=0)  # 13% of taxable
    total_amount = Column(Numeric(12, 2), nullable=False)

    # ── Line items (immutable snapshot) ─────────────────────────────────────
    line_items = Column(JSON, nullable=False, default=list)
    # [{description, quantity, unit_price, amount, taxable}]

    # ── Status ───────────────────────────────────────────────────────────────
    status = Column(String(20), nullable=False, default="issued")

    # ── Reprint ──────────────────────────────────────────────────────────────
    is_reprint = Column(Boolean, nullable=False, default=False)
    reprint_of = Column(String(36), ForeignKey("public.pms_invoices.id"), nullable=True)
    reprint_number = Column(Integer, nullable=True)  # 1, 2, 3 …

    # ── Credit / Debit notes ─────────────────────────────────────────────────
    original_invoice_id = Column(String(36), ForeignKey("public.pms_invoices.id"), nullable=True)
    note_reason = Column(Text, nullable=True)

    # ── CBMS (IRD Central Billing Monitoring System) ─────────────────────────
    cbms_synced = Column(Boolean, nullable=False, default=False)
    cbms_synced_at = Column(DateTime(timezone=True), nullable=True)
    cbms_response = Column(JSON, nullable=True)

    # ── Timestamps (no updated_at — this table is append-only) ───────────────
    issued_at = Column(DateTime(timezone=True),
                       default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self) -> str:
        return f"<PMSInvoice({self.invoice_number}, {self.status})>"
