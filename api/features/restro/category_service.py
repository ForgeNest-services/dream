from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.category_repository import CategoryRepository
from features.restro.seed_lock import ensure_branch_seeded
from features.branches.repository import BranchRepository
from utils.logger import logger

DEFAULT_CATEGORIES = [
    "Hot Beverages",
    "Cold Beverages / Refreshers",
    "Hookah",
    "Fast Food",
    "Thakali Set",
    "Newari Khaja",
    "Cigarettes",
    # Combo menu items live here by convention. The category is just
    # organizational — combo behavior is driven by the `is_combo` flag on
    # individual menu items, not by category name (rename-safe).
    "Combo",
]


class CategoryService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> dict:
        if not CategoryService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        categories = CategoryRepository.list_for_branch(db, tenant_id, branch_id)
        if not categories:
            # Delegates to the shared "seed categories + menu items together"
            # helper — same call as MenuItemService uses, so whichever endpoint
            # fires first on a fresh branch, both categories and menu items
            # end up seeded atomically before the response returns.
            ensure_branch_seeded(db, tenant_id, branch_id)
            categories = CategoryRepository.list_for_branch(db, tenant_id, branch_id)

        return {"success": True, "categories": categories}

    @staticmethod
    def create(db: Session, tenant_id: str, branch_id: str, name: str, display_order: int = 0) -> dict:
        if not CategoryService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        try:
            category = CategoryRepository.create(db, tenant_id, branch_id, name, display_order)
            logger.info(
                f"Category created: {category.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "name": name},
            )
            return {"success": True, "category": category}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Category creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        category_id: str,
        name: str | None = None,
        display_order: int | None = None,
    ) -> dict:
        category = CategoryRepository.get_by_id(db, tenant_id, category_id)
        if not category or not category.is_active:
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}

        try:
            updated = CategoryRepository.update(db, category, name=name, display_order=display_order)
            return {"success": True, "category": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Category update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, category_id: str) -> dict:
        category = CategoryRepository.get_by_id(db, tenant_id, category_id)
        if not category or not category.is_active:
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}

        CategoryRepository.update(db, category, is_active=False)
        logger.info(f"Category deactivated: {category_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
