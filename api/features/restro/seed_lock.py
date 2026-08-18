"""Serializes concurrent auto-seed of categories + menu items per branch.

Problem this fixes: the frontend fires GET /categories and GET /menu-items
in parallel on branch load. Both handlers have an "if empty, auto-seed"
fallback. Without serialization, the menu-items seed can read the categories
list mid-way through the categories seed (which commits rows one at a time),
see only the first category, and skip every menu item whose category name
doesn't match — leaving the branch with a partial menu (e.g. only Hot
Beverage items).

Approach: pg_advisory_lock keyed by branch_id. Session-scoped (survives
across intermediate commits) so the whole seed operation stays under one
mutex — releasing only when we explicitly unlock in the `finally`. Locks
are per-branch, so seeding branch A doesn't block seeding branch B.

If the API process dies mid-seed, Postgres releases the lock automatically
when the DB connection closes — no stuck locks across restarts.
"""

from contextlib import contextmanager
import hashlib

from sqlalchemy import text
from sqlalchemy.orm import Session


def _lock_key(branch_id: str) -> int:
    # pg_advisory_lock takes a bigint. Hash the branch_id string down to a
    # signed 64-bit int. Deterministic per branch so parallel requests for
    # the same branch collide (as intended); different branches get
    # different keys (as intended).
    digest = hashlib.blake2b(
        f"restro:seed:{branch_id}".encode(), digest_size=8
    ).digest()
    n = int.from_bytes(digest, "big", signed=True)
    return n


@contextmanager
def branch_seed_lock(db: Session, branch_id: str):
    """Wrap the seed operation. Blocks until any concurrent seeder for the
    same branch finishes, then yields. Always releases on exit."""
    key = _lock_key(branch_id)
    db.execute(text("SELECT pg_advisory_lock(:k)"), {"k": key})
    try:
        yield
    finally:
        db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})


def ensure_branch_seeded(db: Session, tenant_id: str, branch_id: str) -> None:
    """Idempotent, race-safe seed of default categories + menu items for a
    branch. Both /categories and /menu-items call this on first hit for a
    fresh branch.

    Why one function does both: on a brand-new branch, /menu-items can fire
    before /categories. If the menu-seed runs alone (categories still empty)
    every item skips with 'category not found' — leaving the branch with 0
    items until the frontend refetches. Bundling categories + items behind
    the same lock guarantees categories always exist BEFORE the menu seeder
    runs, regardless of which endpoint triggered the seed.

    Idempotence: re-checks under lock. If another request already seeded
    while we were waiting for the lock, we no-op.
    """
    from features.restro.category_repository import CategoryRepository
    from features.restro.menu_item_repository import MenuItemRepository
    from features.restro.category_service import DEFAULT_CATEGORIES
    from features.restro.menu_seeder import seed_default_menu_items
    from utils.logger import logger

    with branch_seed_lock(db, branch_id):
        # Categories first — the menu seeder resolves category IDs by name,
        # so they MUST be committed before it runs.
        existing_cats = CategoryRepository.list_for_branch(db, tenant_id, branch_id)
        if not existing_cats:
            for i, name in enumerate(DEFAULT_CATEGORIES):
                CategoryRepository.create(
                    db, tenant_id, branch_id, name, display_order=i
                )
            logger.info(
                f"Auto-provisioned default categories for branch {branch_id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id},
            )

        # Then menu items — reads the just-committed categories.
        existing_items = MenuItemRepository.list_for_branch(
            db, tenant_id, branch_id, None
        )
        if not existing_items:
            try:
                seed_default_menu_items(db, tenant_id, branch_id)
            except Exception as e:
                logger.error(
                    f"Default menu seeding failed for branch {branch_id}: {e}"
                )
