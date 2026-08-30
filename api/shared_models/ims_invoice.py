from sqlalchemy import Column, String, Boolean, Integer, Numeric, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSInvoice(Base):
    """A recorded sale — deducts stock (via IMSInvoiceLine + stock movements
    posted alongside, see IMSInvoiceService.create) and posts a sale/payment
    pair to the customer ledger. Append-only in the append-many-fields sense
    (never deleted), but a quotation row (kind="quotation") IS mutated once,
    in place, by IMSInvoiceService.convert — that's the one moment stock
    actually gets deducted and the ledger actually gets posted; a quotation
    itself has neither effect. Real invoices (kind "tax"/"abbreviated") are
    never mutated after creation."""

    __tablename__ = "ims_invoices"
    __table_args__ = (
        Index("ix_ims_invoice_branch_date_bs", "branch_id", "date_bs"),
        Index("ix_ims_invoice_fiscal_year", "fiscal_year_id"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    number = Column(String(50), nullable=False)
    kind = Column(String(20), nullable=False)  # "tax" | "abbreviated" | "quotation"
    date = Column(DateTime, nullable=False)
    date_bs = Column(String(10), nullable=False)
    # Resolved from the invoice's own date_bs (see
    # nepali_date.fiscal_year_start_for_bs_date), not whichever fiscal year
    # happens to be active at creation time — a backdated invoice still
    # lands in the fiscal year its own date actually falls in.
    fiscal_year_id = Column(String(36), ForeignKey("public.ims_fiscal_years.id"), nullable=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("public.ims_parties.id"), nullable=False, index=True)

    # ── Seller snapshot (IRD: snapshotted at issue time) ─────────────────────
    seller_name = Column(String(255), nullable=True)
    seller_address = Column(Text, nullable=True)
    seller_pan = Column(String(50), nullable=True)

    # ── Buyer snapshot (IRD: buyer PAN mandatory for B2B VAT bills) ──────────
    buyer_name = Column(String(255), nullable=True)
    buyer_pan = Column(String(50), nullable=True)
    buyer_address = Column(Text, nullable=True)

    # Snapshotted totals (see lib/invoice.ts's computeTotals) — never
    # recomputed live, matching the project's snapshot convention for
    # booking rate_per_night / invoice vat_breakdown elsewhere.
    gross_amount = Column(Numeric(12, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0)
    taxable_amount = Column(Numeric(12, 2), nullable=False, default=0)
    exempt_amount = Column(Numeric(12, 2), nullable=False, default=0)
    vat_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)

    payment_method = Column(String(20), nullable=False)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False)  # paid | partial | unpaid
    note = Column(String(1000), nullable=True)
    user_id = Column(String(36), nullable=False)

    # ── Reprint (IRD: new row per reprint, watermarked "Copy of Original") ────
    is_reprint = Column(Boolean, nullable=False, default=False)
    reprint_of = Column(String(36), ForeignKey("public.ims_invoices.id"), nullable=True)
    reprint_number = Column(Integer, nullable=True)

    # ── Credit notes (IRD: own serial sequence, reverses original) ───────────
    is_credit_note = Column(Boolean, nullable=False, default=False)
    original_invoice_id = Column(String(36), ForeignKey("public.ims_invoices.id"), nullable=True, index=True)
    note_reason = Column(Text, nullable=True)

    # ── CBMS (IRD Central Billing Monitoring System) ──────────────────────────
    cbms_synced = Column(Boolean, nullable=False, default=False)
    cbms_synced_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    lines = relationship(
        "IMSInvoiceLine", back_populates="invoice", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<IMSInvoice(tenant_id={self.tenant_id}, number={self.number})>"
