from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from shared_models import RestroMenuItem, RestroMenuItemVariant


class MenuItemRepository:
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
    ) -> RestroMenuItem:
        item = RestroMenuItem(
            tenant_id=tenant_id,
            branch_id=branch_id,
            category_id=category_id,
            name=name.strip(),
            has_variants=has_variants,
            price=price,
            image_url=image_url,
        )
        item.variants = [
            RestroMenuItemVariant(name=v["name"].strip(), price=v["price"]) for v in variants
        ]
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, item_id: str) -> RestroMenuItem | None:
        return (
            db.query(RestroMenuItem)
            .options(joinedload(RestroMenuItem.variants))
            .filter(
                RestroMenuItem.id == item_id,
                RestroMenuItem.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_branch(
        db: Session, tenant_id: str, branch_id: str, category_id: str | None = None
    ) -> list[RestroMenuItem]:
        query = (
            db.query(RestroMenuItem)
            .options(joinedload(RestroMenuItem.variants))
            .filter(
                RestroMenuItem.tenant_id == tenant_id,
                RestroMenuItem.branch_id == branch_id,
                RestroMenuItem.is_active == True,
            )
        )
        if category_id:
            query = query.filter(RestroMenuItem.category_id == category_id)
        return query.order_by(RestroMenuItem.name).all()

    @staticmethod
    def update(
        db: Session,
        item: RestroMenuItem,
        category_id: str | None = None,
        name: str | None = None,
        has_variants: bool | None = None,
        price: Decimal | None = None,
        price_explicitly_null: bool = False,
        image_url: str | None = None,
        variants: list[dict] | None = None,
        is_active: bool | None = None,
    ) -> RestroMenuItem:
        if category_id is not None:
            item.category_id = category_id
        if name is not None:
            item.name = name.strip()
        if has_variants is not None:
            item.has_variants = has_variants
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
