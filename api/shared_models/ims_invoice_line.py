from sqlalchemy import Column, String, Boolean, Numeric, ForeignKey
import uuid
from sqlalchemy.orm import relationship
from core.database import Base


class IMSInvoiceLine(Base):
    """One product/variant sold on an invoice. rate is VAT-inclusive when the
    tenant is VAT-registered (matches InvoiceLine.rate's mock doc comment —
    see lib/invoice.ts's splitVatInclusive). taxable is snapshotted at sale
    time, same convention as IMSPurchaseLine."""

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

    invoice = relationship("IMSInvoice", back_populates="lines")

    def __repr__(self):
        return f"<IMSInvoiceLine(invoice_id={self.invoice_id}, variant_id={self.variant_id})>"
