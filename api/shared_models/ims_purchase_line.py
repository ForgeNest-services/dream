from sqlalchemy import Column, String, Boolean, Numeric, ForeignKey
import uuid
from sqlalchemy.orm import relationship
from core.database import Base


class IMSPurchaseLine(Base):
    """One product/variant received on a purchase bill. taxable/tax_rate are
    snapshotted at purchase time (never live-looked-up from the product),
    matching the project-wide snapshot convention used for booking
    rate_per_night and invoice vat_breakdown."""

    __tablename__ = "ims_purchase_lines"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_id = Column(
        String(36), ForeignKey("public.ims_purchases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id = Column(String(36), ForeignKey("public.ims_products.id"), nullable=False)
    variant_id = Column(String(36), ForeignKey("public.ims_variants.id"), nullable=False)
    description = Column(String(300), nullable=False)
    qty = Column(Numeric(12, 3), nullable=False)
    unit_id = Column(String(36), ForeignKey("public.ims_units.id"), nullable=False)
    unit_cost = Column(Numeric(10, 2), nullable=False)
    taxable = Column(Boolean, nullable=False, default=True)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0)
    vat_amount = Column(Numeric(12, 2), nullable=False, default=0)

    purchase = relationship("IMSPurchase", back_populates="lines")

    def __repr__(self):
        return f"<IMSPurchaseLine(purchase_id={self.purchase_id}, variant_id={self.variant_id})>"
