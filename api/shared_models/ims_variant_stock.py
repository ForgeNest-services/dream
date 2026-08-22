from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSVariantStock(Base):
    """One row per (variant, branch) — the on-hand quantity. A real
    relational row (not a JSON column on IMSVariant) so stock is queryable
    and reportable per branch, matching the project's stated preference for
    queryable child rows over JSON blobs (see RestroMenuItemVariant)."""

    __tablename__ = "ims_variant_stock"
    __table_args__ = (
        UniqueConstraint("variant_id", "branch_id", name="uq_ims_variant_stock_variant_branch"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    variant_id = Column(String(36), ForeignKey("public.ims_variants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    # Numeric, not Integer — Unit.allows_decimals items (kg, litre, metre)
    # need fractional on-hand quantities.
    qty = Column(Numeric(12, 3), nullable=False, default=0)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    variant = relationship("IMSVariant", back_populates="stock_rows")

    def __repr__(self):
        return f"<IMSVariantStock(variant_id={self.variant_id}, branch_id={self.branch_id}, qty={self.qty})>"
