from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from datetime import datetime, timezone
import uuid
from core.database import Base


class IMSMedia(Base):
    """Tenant-wide reusable image library ("Media Center") — an uploaded
    image is a named, searchable, folder-organized row here, referenced by
    id from many products via IMSProduct.media_id. Distinct from the
    generic /uploads endpoint's one-shot upload-and-forget model (see
    restro's menu-item image picker) — IMS's picker lets staff browse and
    reuse a previous upload instead of re-uploading the same image."""

    __tablename__ = "ims_media"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("public.tenants.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    folder = Column(String(100), nullable=False, default="Uploads")
    size_kb = Column(Integer, nullable=False, default=0)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<IMSMedia(tenant_id={self.tenant_id}, name={self.name})>"
