from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base


class RestroMenuItemVariant(Base):
    __tablename__ = "restro_menu_item_variants"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    menu_item_id = Column(
        String(36), ForeignKey("public.restro_menu_items.id"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    menu_item = relationship("RestroMenuItem", back_populates="variants")

    def __repr__(self):
        return f"<RestroMenuItemVariant(menu_item_id={self.menu_item_id}, name={self.name})>"
