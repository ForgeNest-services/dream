from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from shared_models import RestroMenuItem, RestroMenuItemVariant, RestroMenuItemComponent


class MenuItemRepository:
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
    ) -> RestroMenuItem:
        item = RestroMenuItem(
            tenant_id=tenant_id,
            branch_id=branch_id,
            category_id=category_id,
            name=name.strip(),
            has_variants=has_variants,
            is_combo=is_combo,
            price=price,
            image_url=image_url,
        )
        item.variants = [
            RestroMenuItemVariant(name=v["name"].strip(), price=v["price"]) for v in variants
        ]
        item.components = [
            RestroMenuItemComponent(
                child_menu_item_id=c["child_menu_item_id"],
                child_variant_name=(c.get("child_variant_name") or None),
                qty=int(c.get("qty") or 1),
                display_order=i,
            )
            for i, c in enumerate(components)
        ]
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, item_id: str) -> RestroMenuItem | None:
        return (
            db.query(RestroMenuItem)
            .options(
                joinedload(RestroMenuItem.variants),
                joinedload(RestroMenuItem.components).joinedload(RestroMenuItemComponent.child),
            )
            .filter(
                RestroMenuItem.id == item_id,
                RestroMenuItem.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_branch(
        db: Session,
        tenant_id: str,
        branch_id: str,
        category_id: str | None = None,
        search: str | None = None,
    ) -> list[RestroMenuItem]:
        from sqlalchemy import func, or_

        query = (
            db.query(RestroMenuItem)
            .options(
                joinedload(RestroMenuItem.variants),
                joinedload(RestroMenuItem.components).joinedload(RestroMenuItemComponent.child),
            )
            .filter(
                RestroMenuItem.tenant_id == tenant_id,
                RestroMenuItem.branch_id == branch_id,
                RestroMenuItem.is_active == True,
            )
        )
        if category_id:
            query = query.filter(RestroMenuItem.category_id == category_id)
        if search:
            # Case-insensitive name match. Variant names would need a subquery
            # join — worth adding later if searching "Buff" should hit every
            # buff momo variant; for now item name is enough.
            term = f"%{search.strip().lower()}%"
            query = query.filter(func.lower(RestroMenuItem.name).like(term))
        return query.order_by(RestroMenuItem.name).all()

    @staticmethod
    def update(
        db: Session,
        item: RestroMenuItem,
        category_id: str | None = None,
        name: str | None = None,
        has_variants: bool | None = None,
        is_combo: bool | None = None,
        price: Decimal | None = None,
        price_explicitly_null: bool = False,
        image_url: str | None = None,
        variants: list[dict] | None = None,
        components: list[dict] | None = None,
        is_active: bool | None = None,
    ) -> RestroMenuItem:
        if category_id is not None:
            item.category_id = category_id
        if name is not None:
            item.name = name.strip()
        if has_variants is not None:
            item.has_variants = has_variants
        if is_combo is not None:
            item.is_combo = is_combo
        if price_explicitly_null:
            item.price = None
        elif price is not None:
            item.price = price
        if image_url is not None:
            item.image_url = image_url
        if variants is not None:
            item.variants = [
                RestroMenuItemVariant(name=v["name"].strip(), price=v["price"]) for v in variants
            ]
        if components is not None:
            item.components = [
                RestroMenuItemComponent(
                    child_menu_item_id=c["child_menu_item_id"],
                    child_variant_name=(c.get("child_variant_name") or None),
                    qty=int(c.get("qty") or 1),
                    display_order=i,
                )
                for i, c in enumerate(components)
            ]
        if is_active is not None:
            item.is_active = is_active
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def set_sold_out(db: Session, item: RestroMenuItem, sold_out: bool) -> RestroMenuItem:
        item.sold_out = sold_out
        db.commit()
        db.refresh(item)
        return item
