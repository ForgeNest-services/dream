from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON
from datetime import datetime, timezone
import uuid
from core.database import Base


class App(Base):
    __tablename__ = "apps"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    tagline = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)
    # Public MinIO URL of the app's logo/icon PNG. Seeded from api/assets/
    # on startup via seed_app_icons(). Frontend prefers this over the
    # react-icons `icon` field when both are present.
    icon_url = Column(String(500), nullable=True)
    # Public MinIO URL of the app's larger preview/thumbnail PNG (e.g. for a
    # catalog card image). Seeded the same way as icon_url, from a separate
    # thumbnail_asset PNG in api/assets/.
    thumbnail_url = Column(String(500), nullable=True)
    url = Column(String(500), nullable=False)
    screenshots = Column(JSON, nullable=True)
    features = Column(JSON, nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    is_public = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<App(code={self.code}, name={self.name})>"
