from sqlalchemy import Column, String, Boolean, Numeric, DateTime, ForeignKey, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSProduct(Base):
    """Tenant-wide catalog entry — shared across every branch, same as
    IMSCategory/IMSBrand. Per-branch quantities live on IMSVariantStock."""

    __tablename__ = "ims_products"
    __table_args__ = (
        # Partial (not plain) unique index — a soft-deleted product's SKU
        # must be reusable by a new product, same pattern as
        # restro_categories' active-name uniqueness.
        Index(
            "uq_ims_product_tenant_sku_active",
            "tenant_id",
            "sku",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    sku = Column(String(100), nullable=False)
    category_id = Column(String(36), ForeignKey("public.ims_categories.id"), nullable=False, index=True)
    brand_id = Column(String(36), ForeignKey("public.ims_brands.id"), nullable=True)
    # Not FK-validated against a media library table yet — that's a separate,
    # not-yet-built feature (see product-form-dialog's MediaPicker). Plain
    # nullable string keeps product creation unblocked until it lands.
    media_id = Column(String(100), nullable=True)
    description = Column(String(2000), nullable=True)
    # Undefined/NULL is treated as taxable — matches Product.taxable's mock
    # doc comment. Stored nullable so "unset" and "false" stay distinguishable.
    taxable = Column(Boolean, nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=True)
    # Harmonized System code — Annexure ६'s एच.एस.कोड line-item column.
    # Manual, optional: the law shows this column on every bill template but
    # never states it's mandatory to populate, and there's no way to derive
    # a customs classification from a product name/category — a wrong
    # auto-guessed code would be worse than a blank one. Left nullable so
    # product creation/sale is never blocked on it.
    hs_code = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    variants = relationship(
        "IMSVariant", back_populates="product", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<IMSProduct(tenant_id={self.tenant_id}, sku={self.sku})>"
