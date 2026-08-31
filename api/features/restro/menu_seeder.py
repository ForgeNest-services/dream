"""Seeds a branch's default menu from menu_seed_data.py.

Runs automatically once per branch — triggered from CategoryService right
after the default categories are provisioned. Idempotent: does nothing if
any menu item already exists for the branch.

Images referenced by seed rows point at a shared, pre-uploaded copy in MinIO
(platform/menu-seed-images/..., uploaded once at API startup — see
core.seed.seed_menu_seed_images) rather than being uploaded per-branch here.
Every tenant's seeded items share the same image bytes/URL; this used to
re-upload the same ~19 images to MinIO on every single new branch, which was
19 sequential network round-trips inside the request that seeds a fresh
branch — the actual cause of a brand-new branch's menu taking 10-15s to
appear. Building a URL is now pure string formatting, no I/O.
"""

from pathlib import Path
from decimal import Decimal
from sqlalchemy.orm import Session

from core.seed import menu_seed_image_url
from features.restro.menu_item_repository import MenuItemRepository
from features.restro.category_repository import CategoryRepository
from features.restro.menu_seed_data import DEFAULT_MENU
from utils.logger import logger


SEED_IMAGES_DIR = Path(__file__).parent / "menu_seed_images"


def _seed_image_url(filename: str) -> str | None:
    """URL for a pre-uploaded seed image, or None if the file isn't present
    on disk (so seed_menu_seed_images wouldn't have uploaded it either) —
    the item is created without an image rather than pointing at a 404."""
    if not filename:
        return None
    path = SEED_IMAGES_DIR / filename
    if not path.exists() or not path.is_file():
        logger.warning(
            f"Seed image not found: {filename} — item will be created without an image"
        )
        return None
    return menu_seed_image_url(filename)


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

        image_url = _seed_image_url(row.get("image", ""))

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
