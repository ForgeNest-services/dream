from sqlalchemy.orm import Session
from core.storage import upload_file, delete_file, key_from_url
from features.ims.media_repository import IMSMediaRepository
from utils.logger import logger

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


class IMSMediaService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str, q: str | None) -> list:
        return IMSMediaRepository.list_for_tenant(db, tenant_id, q)

    @staticmethod
    def upload(
        db: Session,
        tenant_id: str,
        filename: str,
        content: bytes,
        content_type: str,
        folder: str,
    ) -> dict:
        if content_type not in ALLOWED_CONTENT_TYPES:
            return {"success": False, "error_code": "UNSUPPORTED_FILE_TYPE"}
        if len(content) > MAX_UPLOAD_BYTES:
            return {"success": False, "error_code": "FILE_TOO_LARGE"}

        prefix = f"ims/{tenant_id}/media"
        url = upload_file(prefix, filename, content, content_type)
        name = filename.rsplit(".", 1)[0] if "." in filename else filename
        size_kb = max(1, round(len(content) / 1024))

        item = IMSMediaRepository.create(
            db, tenant_id=tenant_id, name=name, url=url, folder=folder or "Uploads", size_kb=size_kb
        )
        logger.info(f"IMS media uploaded: {item.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "media": item}

    @staticmethod
    def delete(db: Session, tenant_id: str, media_id: str) -> dict:
        from shared_models import IMSProduct

        item = IMSMediaRepository.get_by_id(db, tenant_id, media_id)
        if not item:
            return {"success": False, "error_code": "MEDIA_NOT_FOUND"}

        in_use = (
            db.query(IMSProduct)
            .filter(IMSProduct.tenant_id == tenant_id, IMSProduct.media_id == media_id)
            .first()
        )
        if in_use:
            return {"success": False, "error_code": "MEDIA_IN_USE"}

        key = key_from_url(item.url)
        if key:
            delete_file(key)
        IMSMediaRepository.delete(db, item)
        logger.info(f"IMS media deleted: {media_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
