"""Seeds a branch's default menu from menu_seed_data.py.

Runs automatically once per branch — triggered from CategoryService right
after the default categories are provisioned. Idempotent: does nothing if
any menu item already exists for the branch.

Images referenced by seed rows are read from ./menu_seed_images/ and
uploaded to MinIO under the branch's normal menu-items prefix, so seeded
items look identical to items uploaded through the UI.
"""

from pathlib import Path
from decimal import Decimal
from sqlalchemy.orm import Session

from core import storage
from features.restro.menu_item_repository import MenuItemRepository
from features.restro.category_repository import CategoryRepository
from features.restro.menu_seed_data import DEFAULT_MENU
from utils.logger import logger


SEED_IMAGES_DIR = Path(__file__).parent / "menu_seed_images"

_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _upload_seed_image(tenant_id: str, branch_id: str, filename: str) -> str | None:
    """Best-effort upload — missing file or unknown extension returns None
    and the item just gets created without an image. Never raises."""
    if not filename:
        return None
    path = SEED_IMAGES_DIR / filename
    if not path.exists() or not path.is_file():
        logger.warning(
            f"Seed image not found: {filename} — item will be created without an image"
        )
        return None
    mime = _MIME_BY_EXT.get(path.suffix.lower())
    if not mime:
        logger.warning(
            f"Seed image has unsupported extension: {filename} — item will be created without an image"
        )
        return None
    try:
        with open(path, "rb") as f:
            content = f.read()
        prefix = f"restro/{tenant_id}/{branch_id}/menu-items"
        return storage.upload_file(prefix, path.name, content, mime)
    except Exception as e:
        # Upload fails shouldn't block the whole seed run — log and continue.
        logger.error(f"Failed to upload seed image {filename}: {e}")
        return None


def seed_default_menu_items(db: Session, tenant_id: str, branch_id: str) -> int:
    """Populate the branch with sample menu items. No-op if any items already
    exist. Returns the number of items created."""
    existing = MenuItemRepository.list_for_branch(db, tenant_id, branch_id)
    if existing:
        return 0

    # Build category name → id map from what's actually in the DB right now.
    # Keyed by lowercased+stripped name so `"Fast Food"`, `"fast food"`, and
    # `"  Fast Food "` all resolve — a small guard against typos and casing
    # drift between seed data and manually-created categories.
    categories = CategoryRepository.list_for_branch(db, tenant_id, branch_id)
    cat_by_name = {c.name.strip().lower(): c.id for c in categories}

    created = 0
    for row in DEFAULT_MENU:
        cat_name = (row.get("category") or "").strip()
        cat_id = cat_by_name.get(cat_name.lower())
        if not cat_id:
            logger.warning(
                f"Skipping seed item '{row.get('name')}': category '{cat_name}' not found "
                f"on this branch. Available: {sorted(cat_by_name.keys())}"
            )
            continue

        variants = row.get("variants") or []
        has_variants = bool(variants)
        price = row.get("price")

        if has_variants and price is not None:
            logger.warning(
                f"Skipping seed item '{row.get('name')}': has both price and variants"
            )
            continue
        if not has_variants and price is None:
            logger.warning(
                f"Skipping seed item '{row.get('name')}': needs either price or variants"
            )
            continue

        image_url = _upload_seed_image(tenant_id, branch_id, row.get("image", ""))

        try:
            MenuItemRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                category_id=cat_id,
                name=row["name"],
                has_variants=has_variants,
                is_combo=False,
                price=Decimal(str(price)) if price is not None else None,
                image_url=image_url,
                variants=[{"name": v["name"], "price": Decimal(str(v["price"]))} for v in variants],
                components=[],
            )
            created += 1
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to seed menu item '{row.get('name')}': {e}")

    if created > 0:
        logger.info(
            f"Seeded {created} default menu items for branch {branch_id}",
            extra={"tenant_id": tenant_id, "branch_id": branch_id},
        )
    return created
