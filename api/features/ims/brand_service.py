from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.ims.brand_repository import IMSBrandRepository
from utils.logger import logger


class IMSBrandService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list:
        return IMSBrandRepository.list_for_tenant(db, tenant_id)

    @staticmethod
    def create(db: Session, tenant_id: str, name: str) -> dict:
        try:
            brand = IMSBrandRepository.create(db, tenant_id, name)
            logger.info(f"IMS brand created: {brand.id}", extra={"tenant_id": tenant_id, "name": name})
            return {"success": True, "brand": brand}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"IMS brand creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}
