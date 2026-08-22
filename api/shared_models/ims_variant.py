from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSVariant(Base):
    __tablename__ = "ims_variants"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey("public.ims_products.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False, default="Default")
    model_no = Column(String(100), nullable=True)
    barcode = Column(String(100), nullable=True)
    unit_id = Column(String(36), ForeignKey("public.ims_units.id"), nullable=False)
    # Optional purchase-unit conversion, e.g. 1 box (purchase_unit_id) = 12 pcs.
    purchase_unit_id = Column(String(36), ForeignKey("public.ims_units.id"), nullable=True)
    conversion_factor = Column(Numeric(10, 4), nullable=True)
    cost_price = Column(Numeric(10, 2), nullable=False, default=0)
    selling_price = Column(Numeric(10, 2), nullable=False, default=0)
    low_stock_at = Column(Integer, nullable=False, default=10)
    # Optional — a single expiry date per variant (not per batch/lot; this
    # SKU has no batch tracking, so restocking with a different expiry just
    # overwrites this field). Used to flag "expiring soon"/"expired" in the
    # product list.
    expiry_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    product = relationship("IMSProduct", back_populates="variants")
    stock_rows = relationship(
        "IMSVariantStock", back_populates="variant", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<IMSVariant(product_id={self.product_id}, name={self.name})>"
