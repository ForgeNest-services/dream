from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.menu_item_repository import MenuItemRepository
from features.restro.category_repository import CategoryRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


def _validate_pricing(has_variants: bool, price: Decimal | None, variants: list[dict]) -> str | None:
    if has_variants:
        if price is not None:
            return "PRICE_NOT_ALLOWED_WITH_VARIANTS"
        if not variants:
            return "VARIANTS_REQUIRED"
        for v in variants:
            if not v.get("name", "").strip():
                return "VARIANT_NAME_REQUIRED"
    else:
        if price is None:
            return "PRICE_REQUIRED"
        if variants:
            return "VARIANTS_NOT_ALLOWED"
    return None


class MenuItemService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def _assert_category_in_branch(db: Session, tenant_id: str, branch_id: str, category_id: str) -> bool:
        category = CategoryRepository.get_by_id(db, tenant_id, category_id)
        return bool(category and category.branch_id == branch_id and category.is_active)

    @staticmethod
    def list_for_branch(
        db: Session, tenant_id: str, branch_id: str, category_id: str | None = None
    ) -> dict:
        if not MenuItemService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        items = MenuItemRepository.list_for_branch(db, tenant_id, branch_id, category_id)
        return {"success": True, "items": items}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        category_id: str,
        name: str,
        has_variants: bool,
        price: Decimal | None,
        image_url: str | None,
        variants: list[dict],
    ) -> dict:
        if not MenuItemService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if not MenuItemService._assert_category_in_branch(db, tenant_id, branch_id, category_id):
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}

        error = _validate_pricing(has_variants, price, variants)
        if error:
            return {"success": False, "error_code": error}

        try:
            item = MenuItemRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                category_id=category_id,
                name=name,
                has_variants=has_variants,
                price=price,
                image_url=image_url,
                variants=variants,
            )
            logger.info(
                f"Menu item created: {item.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "name": name},
            )
            return {"success": True, "item": item}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Menu item creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        item_id: str,
        category_id: str | None = None,
        name: str | None = None,
        has_variants: bool | None = None,
        price: Decimal | None = None,
        price_explicitly_null: bool = False,
        image_url: str | None = None,
        variants: list[dict] | None = None,
    ) -> dict:
        item = MenuItemRepository.get_by_id(db, tenant_id, item_id)
        if not item or not item.is_active or item.branch_id != branch_id:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}

        if category_id and not MenuItemService._assert_category_in_branch(db, tenant_id, branch_id, category_id):
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}

        effective_has_variants = has_variants if has_variants is not None else item.has_variants
        effective_price = None if price_explicitly_null else (price if price is not None else item.price)
        effective_variants = (
            variants
            if variants is not None
            else [{"name": v.name, "price": v.price} for v in item.variants]
        )

        error = _validate_pricing(effective_has_variants, effective_price, effective_variants)
        if error:
            return {"success": False, "error_code": error}

        try:
            updated = MenuItemRepository.update(
                db,
                item,
                category_id=category_id,
                name=name,
                has_variants=has_variants,
                price=price,
                price_explicitly_null=price_explicitly_null,
                image_url=image_url,
                variants=variants,
            )
            return {"success": True, "item": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Menu item update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def set_sold_out(db: Session, tenant_id: str, branch_id: str, item_id: str, sold_out: bool) -> dict:
        item = MenuItemRepository.get_by_id(db, tenant_id, item_id)
        if not item or not item.is_active or item.branch_id != branch_id:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}
        updated = MenuItemRepository.set_sold_out(db, item, sold_out)
        return {"success": True, "item": updated}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str, item_id: str) -> dict:
        item = MenuItemRepository.get_by_id(db, tenant_id, item_id)
        if not item or not item.is_active or item.branch_id != branch_id:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}
        MenuItemRepository.update(db, item, is_active=False)
        logger.info(f"Menu item deactivated: {item_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
