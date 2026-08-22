from sqlalchemy import Column, String, Boolean, Numeric, ForeignKey
import uuid
from sqlalchemy.orm import relationship
from core.database import Base


class IMSInvoiceLine(Base):
    """One product/variant sold on an invoice. rate is VAT-EXCLUSIVE — the
    same convention as IMSPurchaseLine.unit_cost and IMSVariant.selling_price
    (see docs/arch.md). VAT is added on top of rate, never backed out of it.
    tax_rate/vat_amount are snapshotted per line at sale time (mirrors
    IMSPurchaseLine) so a historical invoice's VAT can be recomputed from its
    own lines even if the branch's vat_rate changes later."""

    __tablename__ = "ims_invoice_lines"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id = Column(
        String(36), ForeignKey("public.ims_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id = Column(String(36), ForeignKey("public.ims_products.id"), nullable=False)
    variant_id = Column(String(36), ForeignKey("public.ims_variants.id"), nullable=False)
    description = Column(String(300), nullable=False)
    qty = Column(Numeric(12, 3), nullable=False)
    unit_id = Column(String(36), ForeignKey("public.ims_units.id"), nullable=False)
    rate = Column(Numeric(10, 2), nullable=False)
    discount = Column(Numeric(10, 2), nullable=False, default=0)
    taxable = Column(Boolean, nullable=False, default=True)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0)
    vat_amount = Column(Numeric(12, 2), nullable=False, default=0)

    invoice = relationship("IMSInvoice", back_populates="lines")

    def __repr__(self):
        return f"<IMSInvoiceLine(invoice_id={self.invoice_id}, variant_id={self.variant_id})>"
