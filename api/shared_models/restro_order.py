from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Numeric,
    Text,
    DateTime,
    ForeignKey,
    Index,
    text,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroOrder(Base):
    """A single bill — either dine-in (tied to a table) or delivery (tied to a
    customer via customer_id). `status='draft'` is an open bill; `paid` is
    closed; `cancelled` was abandoned. Merged tables share one draft order via
    the merge group lookup (see order_repository.get_draft_for_table).

    Payment methods:
      cash / qr  → immediate settlement; paid_at and settled_at both = now()
      khata      → running-tab close; paid_at = now(), settled_at = NULL until
                   the customer pays down their balance via the settle-khata
                   endpoint. Requires customer_id.

    Delivery orders always require customer_id — inline customer name/phone/
    address columns were dropped when khata unified the customer story."""

    __tablename__ = "restro_orders"
    __table_args__ = (
        # At most one open bill per dine-in table at a time.
        Index(
            "uq_restro_order_open_per_table",
            "table_id",
            unique=True,
            postgresql_where=text("status = 'draft' AND type = 'dine-in'"),
        ),
        Index("ix_restro_order_branch_status", "branch_id", "status"),
        Index("ix_restro_order_branch_kitchen", "branch_id", "kitchen_status"),
        # Fiscal-year / monthly BS reporting hits this index.
        Index("ix_restro_order_branch_placed_bs", "branch_id", "placed_at_bs"),
        # Hot path for a customer's outstanding khata balance.
        Index(
            "ix_restro_order_customer_khata",
            "customer_id",
            "settled_at",
            postgresql_where=text("payment_method = 'khata'"),
        ),
        # Sequential per-branch-per-fiscal-year bill numbers (IRD requires
        # reset to 1 at Shrawan 1 each year). Populated via SELECT FOR UPDATE
        # on restro_invoice_serials; UNIQUE constraint catches any races.
        Index("uq_restro_order_bill_number", "branch_id", "fiscal_year", "bill_number", unique=True),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    # Nullable for delivery orders. For dine-in it points to the "primary"
    # table of a merge group (or the sole table if not merged).
    table_id = Column(String(36), ForeignKey("public.restro_tables.id"), nullable=True, index=True)
    # Human-friendly sequential bill number, unique per branch. Starts at 1.
    # See OrderRepository.create — computed under the same DB session so a
    # concurrent conflict on the UNIQUE index triggers a retry.
    bill_number = Column(Integer, nullable=False)
    # Nepali fiscal year of this bill — e.g. "2081-82". Populated at create
    # time; required for per-year serial reset (IRD requirement).
    fiscal_year = Column(String(10), nullable=True)
    # Required for delivery orders (populated on create), and for orders
    # closed as payment_method='khata' (populated on mark-paid). Optional
    # for cash/qr dine-in.
    customer_id = Column(String(36), ForeignKey("public.restro_customers.id"), nullable=True, index=True)

    type = Column(String(20), nullable=False)  # "dine-in" | "delivery"
    status = Column(String(20), nullable=False, default="draft")  # draft|paid|cancelled
    kitchen_status = Column(String(20), nullable=False, default="new")  # new|cooking|ready|served
    # IRD: simplified (संक्षिप्त कर बिजक) vs full VAT breakdown bill — set at
    # mark-paid time, mirrors IMSInvoice.kind minus "quotation" (RMS has no
    # quotation concept). Display-only: the actual VAT math is identical
    # either way (see order_service.py's mark_paid), this only controls
    # whether the taxable/VAT lines are itemized on the printed bill.
    kind = Column(String(20), nullable=True)  # "tax" | "abbreviated"

    placed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    paid_at = Column(DateTime, nullable=True)
    settled_at = Column(DateTime, nullable=True)

    # Bikram Sambat mirrors, snapshotted at write time. Kept as real columns
    # (not views) so reports hit an index and records survive calendar-table
    # corrections. See api/utils/bikram_sambat.py.
    placed_at_bs = Column(String(10), nullable=False)
    paid_at_bs = Column(String(10), nullable=True)
    settled_at_bs = Column(String(10), nullable=True)

    discount_type = Column(String(10), nullable=False, default="percent")  # percent|flat
    discount_value = Column(Numeric(10, 2), nullable=False, default=0)
    # Annexure-5's "Discount" field wants the actual rupee amount deducted,
    # snapshotted at mark-paid time — not the type/value INPUT above, which
    # is just "10%" or "Rs 50" and requires recomputing against the
    # subtotal to get a real figure. Populated once, alongside
    # subtotal/taxable/vat/total below, never live-recomputed after.
    discount_amount = Column(Numeric(12, 2), nullable=True)

    # ── VAT breakdown (IRD: snapshotted at mark-paid time) ───────────────────
    subtotal_amount = Column(Numeric(12, 2), nullable=True)  # before discount
    taxable_amount = Column(Numeric(12, 2), nullable=True)   # after discount, VAT-applicable
    exempt_amount = Column(Numeric(12, 2), nullable=True)    # non-taxable items
    vat_amount = Column(Numeric(12, 2), nullable=True)       # 13% of taxable
    total_amount = Column(Numeric(12, 2), nullable=True)     # grand total

    # cash|qr|khata — set on mark-paid.
    payment_method = Column(String(16), nullable=True)

    # ── Seller snapshot (IRD: captured at bill-close time) ───────────────────
    seller_name = Column(String(255), nullable=True)
    seller_address = Column(Text, nullable=True)
    seller_pan = Column(String(50), nullable=True)

    # ── Buyer snapshot (IRD: buyer PAN mandatory for B2B VAT bills) ──────────
    buyer_name = Column(String(200), nullable=True)
    buyer_pan = Column(String(50), nullable=True)

    # Snapshot of the waiter who opened the order. `waiter_cred_id` is FK-lite
    # (no cascade) so credential deletion doesn't wipe history.
    waiter_name = Column(String(100), nullable=False)
    waiter_cred_id = Column(String(36), nullable=True)

    # Delivery workflow status (only meaningful for type='delivery').
    delivery_status = Column(String(20), nullable=True)  # pending|out|delivered

    # ── Reprint (IRD: printing a paid bill more than once must be visibly
    # marked) — unlike IMS/PMS invoices, bill_number is a plain sequential
    # Integer (not a formatted string), so a reprint can't carry a suffixed
    # "42/Copy-1"-style number without either breaking the UNIQUE(branch,
    # fiscal_year, bill_number) constraint or switching that column to a
    # string platform-wide. Simpler and sufficient: track how many times
    # THIS bill has been printed, on the original row itself, no new row per
    # print. print_count == 1 after the first print (original, no
    # watermark); every print beyond that is a reprint (watermark "COPY OF
    # ORIGINAL"). is_reprint/reprint_of/reprint_number below are legacy
    # columns from an earlier row-per-reprint design that was never wired up
    # — kept (nullable/default-false) so they're harmless if something still
    # references them, but print_count is the real mechanism now.
    print_count = Column(Integer, nullable=False, default=0)
    is_reprint = Column(Boolean, nullable=False, default=False)
    reprint_of = Column(String(36), ForeignKey("public.restro_orders.id"), nullable=True)
    reprint_number = Column(Integer, nullable=True)
    # Annexure-5's Is_Bill_Printed/Printed_Time/Printed_By — Printed_By is
    # deliberately separate from waiter_cred_id (Entered_By): whoever
    # opened/took the order isn't necessarily who triggered the print
    # (e.g. a manager reprinting a bill later at the counter).
    is_bill_printed = Column(Boolean, nullable=False, default=False)
    printed_time = Column(DateTime(timezone=True), nullable=True)
    printed_by = Column(String(36), nullable=True)

    # ── Credit notes (IRD: reversal of a paid bill) ───────────────────────────
    is_credit_note = Column(Boolean, nullable=False, default=False)
    original_order_id = Column(String(36), ForeignKey("public.restro_orders.id"), nullable=True, index=True)
    note_reason = Column(Text, nullable=True)

    # ── CBMS (IRD Central Billing Monitoring System) ──────────────────────────
    cbms_synced = Column(Boolean, nullable=False, default=False)
    cbms_synced_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    lines = relationship(
        "RestroOrderLine",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="RestroOrderLine.created_at",
    )
    customer = relationship("RestroCustomer", lazy="joined")

    def __repr__(self):
        return f"<RestroOrder(id={self.id}, type={self.type}, status={self.status})>"
