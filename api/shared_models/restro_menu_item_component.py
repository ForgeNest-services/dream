from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroMenuItemComponent(Base):
    """One line of a combo's composition. A combo menu item (parent) points
    at N child menu items — the actual dishes the kitchen has to make. On
    the customer receipt the combo shows as a single line at the combo's
    price; on the KOT the composition is spelled out so cooks know what to
    prep."""

    __tablename__ = "restro_menu_item_components"
    __table_args__ = (
        Index("ix_menu_item_component_parent", "parent_menu_item_id"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Cascade delete: if the combo item is deleted, its composition goes with
    # it. Doesn't cascade the child items — those are shared menu rows.
    parent_menu_item_id = Column(
        String(36),
        ForeignKey("public.restro_menu_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    child_menu_item_id = Column(
        String(36),
        ForeignKey("public.restro_menu_items.id"),
        nullable=False,
    )
    # If the child item has variants, pin which one this combo uses.
    # NULL for children without variants (matches the frontend model).
    child_variant_name = Column(String(100), nullable=True)
    qty = Column(Integer, nullable=False, default=1)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    parent = relationship(
        "RestroMenuItem",
        foreign_keys=[parent_menu_item_id],
        back_populates="components",
    )
    child = relationship("RestroMenuItem", foreign_keys=[child_menu_item_id])

    @property
    def child_name(self) -> str:
        """Pydantic (`from_attributes=True`) picks this up as a serialized
        field — saves the frontend a second fetch to render "2× Steam Momo"
        instead of "2× <uuid>". Falls back to empty string if the child was
        deleted (shouldn't happen — child FK has no cascade — but defensive)."""
        return self.child.name if self.child else ""

    def __repr__(self):
        return f"<RestroMenuItemComponent(parent={self.parent_menu_item_id}, child={self.child_menu_item_id}, qty={self.qty})>"
