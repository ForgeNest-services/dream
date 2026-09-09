"""Public contact-form submissions (ui/contact.html) — no tenant_id, since
these come in before any account exists. Superadmin-only read via
/queries/admin/*, see features/queries/."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Index
from core.database import Base


class Query(Base):
    __tablename__ = "queries"
    __table_args__ = (
        Index("ix_queries_created_at", "created_at"),
        {"schema": "public"},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    business_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    app_interest = Column(String(20), nullable=True)  # 'rms' | 'ims' | 'bundle' | None ("not sure yet")
    message = Column(Text, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Query({self.email})>"
