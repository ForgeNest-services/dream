from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric
from datetime import datetime, timezone
import uuid
from core.database import Base


class Module(Base):
    __tablename__ = "modules"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    is_core = Column(Boolean, default=False, nullable=False)
    scope = Column(String(20), default="tenant", nullable=False)
    default_trial_days = Column(Integer, default=30, nullable=False)
    monthly_price = Column(Numeric(10, 2), nullable=False)
    yearly_price = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<Module(code={self.code}, name={self.name})>"
