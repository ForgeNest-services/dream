from sqlalchemy import Column, String, DateTime, ForeignKey, Index, text
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSCategory(Base):
    """Tenant-scoped category tree (unlimited nesting via parent_id) — unlike
    Restro's flat, branch-scoped categories, IMS categories are shared across
    every branch the tenant runs, matching the mock model's Category type.

    Two partial unique indexes (not one plain UNIQUE) because Postgres treats
    each NULL in a unique index as distinct — a plain UNIQUE(tenant_id,
    parent_id, name) would let unlimited duplicate *root* categories (where
    parent_id IS NULL) slip through. The `... WHERE parent_id IS NULL` index
    closes that gap; the sibling one covers nested categories as normal."""

    __tablename__ = "ims_categories"
    __table_args__ = (
        Index(
            "uq_ims_category_tenant_parent_name",
            "tenant_id",
            "parent_id",
            "name",
            unique=True,
            postgresql_where=text("parent_id IS NOT NULL"),
        ),
        Index(
            "uq_ims_category_tenant_root_name",
            "tenant_id",
            "name",
            unique=True,
            postgresql_where=text("parent_id IS NULL"),
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    parent_id = Column(String(36), ForeignKey("public.ims_categories.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<IMSCategory(tenant_id={self.tenant_id}, name={self.name})>"
