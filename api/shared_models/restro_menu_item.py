from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey, Index, text
from sqlalchemy.orm import relationship, foreign
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroMenuItem(Base):
    __tablename__ = "restro_menu_items"
    __table_args__ = (
        Index(
            "uq_restro_menu_item_active_name",
            "branch_id",
            "name",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("public.branches.id"), nullable=False, index=True)
    category_id = Column(
        String(36), ForeignKey("public.restro_categories.id"), nullable=False, index=True
    )
    name = Column(String(150), nullable=False)
    image_url = Column(String(1000), nullable=True)
    has_variants = Column(Boolean, nullable=False, default=False)
    # Combos are menu items composed of other menu items. Mutually exclusive
    # with has_variants — a combo has a single flat price and >=1 components
    # in RestroMenuItemComponent. Enforced at the service layer.
    is_combo = Column(Boolean, nullable=False, default=False)
    price = Column(Numeric(10, 2), nullable=True)
    sold_out = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    variants = relationship(
        "RestroMenuItemVariant",
        back_populates="menu_item",
        cascade="all, delete-orphan",
        order_by="RestroMenuItemVariant.created_at",
    )
    components = relationship(
        "RestroMenuItemComponent",
        foreign_keys="RestroMenuItemComponent.parent_menu_item_id",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="RestroMenuItemComponent.display_order",
    )

    def __repr__(self):
        return f"<RestroMenuItem(branch_id={self.branch_id}, name={self.name})>"
