"""Public newsletter signups (ui/index.html's "Get notified" form) — no
tenant_id, same reasoning as Query (shared_models/query.py): these come in
before any account exists. Superadmin-only read via /subscribers/admin,
see features/subscribers/."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Index
from core.database import Base


class Subscriber(Base):
    __tablename__ = "subscribers"
    __table_args__ = (
        Index("ix_subscribers_created_at", "created_at"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, unique=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Subscriber({self.email})>"
