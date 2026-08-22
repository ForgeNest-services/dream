from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.ims.category_repository import IMSCategoryRepository
from utils.logger import logger


class IMSCategoryService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> dict:
        return {"success": True, "categories": IMSCategoryRepository.list_for_tenant(db, tenant_id)}

    @staticmethod
    def create(db: Session, tenant_id: str, name: str, parent_id: str | None) -> dict:
        if parent_id and not IMSCategoryRepository.get_by_id(db, tenant_id, parent_id):
            return {"success": False, "error_code": "PARENT_NOT_FOUND"}

        try:
            category = IMSCategoryRepository.create(db, tenant_id, name, parent_id)
            logger.info(
                f"IMS category created: {category.id}",
                extra={"tenant_id": tenant_id, "name": name, "parent_id": parent_id},
            )
            return {"success": True, "category": category}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"IMS category creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def rename(db: Session, tenant_id: str, category_id: str, name: str) -> dict:
        category = IMSCategoryRepository.get_by_id(db, tenant_id, category_id)
        if not category:
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}

        try:
            updated = IMSCategoryRepository.update(db, category, name=name)
            return {"success": True, "category": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"IMS category rename failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, category_id: str) -> dict:
        category = IMSCategoryRepository.get_by_id(db, tenant_id, category_id)
        if not category:
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}

        if IMSCategoryRepository.has_children(db, tenant_id, category_id):
            return {"success": False, "error_code": "CATEGORY_HAS_CHILDREN"}

        IMSCategoryRepository.delete(db, category)
        logger.info(f"IMS category deleted: {category_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
