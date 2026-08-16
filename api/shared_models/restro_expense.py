from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Index
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroExpense(Base):
    """Branch-scoped operating expense — utilities, rent, restocks (in the
    accounting sense; inventory has its own restock ledger), etc. Kept
    separately from orders so reports can show net = sales − expenses.

    `spent_at_bs` is the business-day the expense belongs to (owner enters
    via BS date picker). Sorts lexically as "YYYY-MM-DD" so date-range
    queries against reports match the same shape as order.placed_at_bs."""

    __tablename__ = "restro_expenses"
    __table_args__ = (
        # Hot path: expense totals for a date range on a branch (Reports).
        Index("ix_restro_expense_branch_date", "branch_id", "spent_at_bs"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    # Free-form category — the frontend offers a curated list (Utilities /
    # Supplies / Rent / Maintenance / Other) but the column doesn't enforce
    # it, so tenants can add their own labels down the line.
    category = Column(String(64), nullable=False, default="Other")
    amount = Column(Numeric(12, 2), nullable=False)
    note = Column(String(500), nullable=True)
    # BS calendar day this expense hits — "YYYY-MM-DD" in BS.
    spent_at_bs = Column(String(10), nullable=False)
    # Snapshot of who recorded it, so the log survives credential renames.
    actor_name = Column(String(150), nullable=False)
    actor_cred_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<RestroExpense(branch_id={self.branch_id}, amount={self.amount})>"
