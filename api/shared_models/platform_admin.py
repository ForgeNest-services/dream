from sqlalchemy import Column, String, Boolean, DateTime
from datetime import datetime, timezone
import uuid
from core.database import Base


class PlatformAdmin(Base):
    __tablename__ = "platform_admins"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<PlatformAdmin(id={self.id}, email={self.email})>"
