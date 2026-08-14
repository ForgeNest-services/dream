from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.menu_item_repository import MenuItemRepository
from features.restro.category_repository import CategoryRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


def _validate_shape(
    has_variants: bool,
    is_combo: bool,
    price: Decimal | None,
    variants: list[dict],
    components: list[dict],
) -> str | None:
    # Combo + variants are mutually exclusive — a combo is defined by its
    # composition, which is orthogonal to variant selection.
    if is_combo and has_variants:
        return "COMBO_CANNOT_HAVE_VARIANTS"

    if is_combo:
        if price is None:
            return "PRICE_REQUIRED"
        if variants:
            return "VARIANTS_NOT_ALLOWED"
        if not components:
            return "COMPONENTS_REQUIRED"
        for c in components:
            if not c.get("child_menu_item_id"):
                return "COMPONENT_ITEM_REQUIRED"
            try:
                qty = int(c.get("qty") or 0)
            except (TypeError, ValueError):
                return "COMPONENT_QTY_INVALID"
            if qty < 1:
                return "COMPONENT_QTY_INVALID"
        return None

    # Non-combo: components must be empty.
    if components:
        return "COMPONENTS_NOT_ALLOWED"

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


def _validate_component_targets(
    db, tenant_id: str, branch_id: str, components: list[dict], parent_item_id: str | None
) -> str | None:
    """Every component must reference a real, active, non-combo menu item in
    the same branch. Also refuses self-referencing (combo can't include
    itself — trivial infinite loop) and nested combos (combos of combos —
    not worth the complexity for MVP)."""
    if not components:
        return None
    for c in components:
        child_id = c.get("child_menu_item_id")
        if parent_item_id and child_id == parent_item_id:
            return "COMPONENT_SELF_REFERENCE"
        child = MenuItemRepository.get_by_id(db, tenant_id, child_id)
        if not child or child.branch_id != branch_id or not child.is_active:
            return "COMPONENT_ITEM_NOT_FOUND"
        if child.is_combo:
            return "COMPONENT_CANNOT_BE_COMBO"
        variant_name = c.get("child_variant_name")
        if child.has_variants:
            if not variant_name:
                return "COMPONENT_VARIANT_REQUIRED"
            if not any(v.name == variant_name for v in child.variants):
                return "COMPONENT_VARIANT_NOT_FOUND"
        # If child has no variants but caller passed one, ignore silently —
        # UI shouldn't ever send it, but no need to reject here.
    return None


def combo_note_from_components(item) -> str:
    """Auto-generated composition summary for order-line notes. Rendered on
    the KOT so the kitchen sees what to prep; the customer receipt is
    unchanged and just shows the combo name + price."""
    if not item.is_combo or not item.components:
        return ""
    parts = []
    for c in item.components:
        # `c.child` was joined-loaded by the repository — safe to touch.
        child = c.child
        label = child.name if child else "?"
        if c.child_variant_name:
            label = f"{label} ({c.child_variant_name})"
        parts.append(f"{c.qty}× {label}")
    return "Combo: " + " + ".join(parts)


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
        is_combo: bool,
        price: Decimal | None,
        image_url: str | None,
        variants: list[dict],
        components: list[dict],
    ) -> dict:
        if not MenuItemService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if not MenuItemService._assert_category_in_branch(db, tenant_id, branch_id, category_id):
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}

        error = _validate_shape(has_variants, is_combo, price, variants, components)
        if error:
            return {"success": False, "error_code": error}

        error = _validate_component_targets(db, tenant_id, branch_id, components, None)
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
                is_combo=is_combo,
                price=price,
                image_url=image_url,
                variants=variants,
                components=components,
            )
            logger.info(
                f"Menu item created: {item.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "name": name, "is_combo": is_combo},
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
        is_combo: bool | None = None,
        price: Decimal | None = None,
        price_explicitly_null: bool = False,
        image_url: str | None = None,
        variants: list[dict] | None = None,
        components: list[dict] | None = None,
    ) -> dict:
        item = MenuItemRepository.get_by_id(db, tenant_id, item_id)
        if not item or not item.is_active or item.branch_id != branch_id:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}

        if category_id and not MenuItemService._assert_category_in_branch(db, tenant_id, branch_id, category_id):
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}

        effective_has_variants = has_variants if has_variants is not None else item.has_variants
        effective_is_combo = is_combo if is_combo is not None else item.is_combo
        effective_price = None if price_explicitly_null else (price if price is not None else item.price)
        effective_variants = (
            variants
            if variants is not None
            else [{"name": v.name, "price": v.price} for v in item.variants]
        )
        effective_components = (
            components
            if components is not None
            else [
                {
                    "child_menu_item_id": c.child_menu_item_id,
                    "child_variant_name": c.child_variant_name,
                    "qty": c.qty,
                }
                for c in item.components
            ]
        )

        error = _validate_shape(
            effective_has_variants,
            effective_is_combo,
            effective_price,
            effective_variants,
            effective_components,
        )
        if error:
            return {"success": False, "error_code": error}

        error = _validate_component_targets(
            db, tenant_id, branch_id, effective_components, item_id
        )
        if error:
            return {"success": False, "error_code": error}

        try:
            updated = MenuItemRepository.update(
                db,
                item,
                category_id=category_id,
                name=name,
                has_variants=has_variants,
                is_combo=is_combo,
                price=price,
                price_explicitly_null=price_explicitly_null,
                image_url=image_url,
                variants=variants,
                components=components,
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
