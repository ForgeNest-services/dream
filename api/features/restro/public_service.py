"""Public (unauthenticated) restaurant reads for the QR-menu page.

Reachable by anyone with a branch UUID — the URL is printed on a QR code so
practical exposure is "whoever's in the restaurant." Everything here is
read-only and returns only fields we're comfortable showing on a guest-facing
menu. No prices for internal-only items, no soft-deleted / inactive rows.

Branch lookup is by ID alone (there's no tenant scope on a public request),
so callers can only see what they already know the ID of — UUID guessing at
2^122 is a non-issue.
"""

from sqlalchemy.orm import Session, joinedload

from shared_models import (
    Branch,
    RestroCategory,
    RestroMenuItem,
)


def get_public_menu(db: Session, branch_id: str) -> dict | None:
    """Returns branch + categories + items in one payload. `None` if the
    branch doesn't exist or is inactive — router turns that into a 404.

    Categories are sorted by (display_order, name). Items are sorted by
    name inside each category. Empty categories are dropped so the guest
    sees a compact menu, not a wall of blank section headers."""
    branch = (
        db.query(Branch)
        .filter(Branch.id == branch_id, Branch.is_active == True)
        .first()
    )
    if not branch:
        return None

    categories = (
        db.query(RestroCategory)
        .filter(
            RestroCategory.tenant_id == branch.tenant_id,
            RestroCategory.branch_id == branch_id,
            RestroCategory.is_active == True,
        )
        .order_by(RestroCategory.display_order, RestroCategory.name)
        .all()
    )

    # Fetch all active items in one shot with variants eager-loaded, then
    # group in Python. One query total, not one-per-category — matters when
    # a branch has 20+ categories.
    items = (
        db.query(RestroMenuItem)
        .options(joinedload(RestroMenuItem.variants))
        .filter(
            RestroMenuItem.tenant_id == branch.tenant_id,
            RestroMenuItem.branch_id == branch_id,
            RestroMenuItem.is_active == True,
        )
        .order_by(RestroMenuItem.name)
        .all()
    )

    items_by_cat: dict[str, list[RestroMenuItem]] = {}
    for it in items:
        items_by_cat.setdefault(it.category_id, []).append(it)

    return {
        "branch": {
            "id": branch.id,
            "name": branch.name,
            "address": branch.address,
            "city": branch.city,
            "phone": branch.phone,
        },
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "items": [
                    {
                        "id": it.id,
                        "name": it.name,
                        "image_url": it.image_url,
                        "has_variants": it.has_variants,
                        "price": str(it.price) if it.price is not None else None,
                        "sold_out": it.sold_out,
                        "variants": [
                            {"name": v.name, "price": str(v.price)}
                            for v in it.variants
                        ],
                    }
                    for it in items_by_cat.get(c.id, [])
                ],
            }
            for c in categories
            # Drop empty categories — a header with no items is dead weight
            # on a phone-screen menu.
            if items_by_cat.get(c.id)
        ],
    }
