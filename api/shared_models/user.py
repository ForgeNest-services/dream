from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from core.database import Base
from core.roles import UserRole


class User(Base):
    __tablename__ = "users"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=True)
    owner_id = Column(String(36), ForeignKey("public.users.id"), nullable=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=True)
    picture_url = Column(String(500), nullable=True)
    role = Column(String(50), default=UserRole.OWNER)
    is_owner = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    tenant = relationship("Tenant", back_populates="users")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, is_owner={self.is_owner})>"
