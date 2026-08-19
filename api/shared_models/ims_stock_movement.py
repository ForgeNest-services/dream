from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSStockMovement(Base):
    """Append-only audit trail — every stock change (restock, adjust-in/out,
    sale, transfer) is a row here, mirroring StockMovement in the mock and
    the DB grants convention noted for invoices/audit_log elsewhere in
    CLAUDE.md (INSERT+SELECT only, never UPDATE/DELETE from app code)."""

    __tablename__ = "ims_stock_movements"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("public.ims_products.id"), nullable=False)
    variant_id = Column(String(36), ForeignKey("public.ims_variants.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # restock | adjust-in | adjust-out | sale | transfer
    qty = Column(Numeric(12, 3), nullable=False)  # signed, in base unit
    unit_cost = Column(Numeric(10, 2), nullable=True)
    balance_after = Column(Numeric(12, 3), nullable=False)
    reason = Column(String(500), nullable=True)
    reference = Column(String(200), nullable=True)
    supplier_id = Column(String(36), nullable=True)
    user_id = Column(String(36), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<IMSStockMovement(variant_id={self.variant_id}, type={self.type}, qty={self.qty})>"
