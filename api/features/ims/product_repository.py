from sqlalchemy.orm import Session, joinedload
from shared_models import IMSProduct, IMSVariant, IMSVariantStock


class IMSProductRepository:
    @staticmethod
    def create(db: Session, tenant_id: str, **fields) -> IMSProduct:
        product = IMSProduct(tenant_id=tenant_id, **fields)
        db.add(product)
        db.commit()
        db.refresh(product)
        return product

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, product_id: str) -> IMSProduct | None:
        return (
            db.query(IMSProduct)
            .options(joinedload(IMSProduct.variants).joinedload(IMSVariant.stock_rows))
            .filter(IMSProduct.id == product_id, IMSProduct.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        q: str | None,
        category_id: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[IMSProduct], int]:
        from sqlalchemy import func

        query = (
            db.query(IMSProduct)
            .options(joinedload(IMSProduct.variants).joinedload(IMSVariant.stock_rows))
            .filter(IMSProduct.tenant_id == tenant_id)
        )
        if category_id:
            query = query.filter(IMSProduct.category_id == category_id)
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.filter(
                func.lower(IMSProduct.name).like(term) | func.lower(IMSProduct.sku).like(term)
            )
        total = query.distinct().count()
        items = (
            query.order_by(IMSProduct.name)
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    @staticmethod
    def update(db: Session, product: IMSProduct, **fields) -> IMSProduct:
        for key, value in fields.items():
            setattr(product, key, value)
        db.commit()
        db.refresh(product)
        return product

    @staticmethod
    def sku_exists(db: Session, tenant_id: str, sku: str, exclude_id: str | None = None) -> bool:
        query = db.query(IMSProduct).filter(
            IMSProduct.tenant_id == tenant_id, IMSProduct.sku == sku
        )
        if exclude_id:
            query = query.filter(IMSProduct.id != exclude_id)
        return query.first() is not None

    @staticmethod
    def add_variant(db: Session, product_id: str, **fields) -> IMSVariant:
        variant = IMSVariant(product_id=product_id, **fields)
        db.add(variant)
        db.commit()
        db.refresh(variant)
        return variant

    @staticmethod
    def get_variant(db: Session, tenant_id: str, variant_id: str) -> IMSVariant | None:
        return (
            db.query(IMSVariant)
            .join(IMSProduct, IMSVariant.product_id == IMSProduct.id)
            .options(joinedload(IMSVariant.stock_rows))
            .filter(IMSVariant.id == variant_id, IMSProduct.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def update_variant(db: Session, variant: IMSVariant, **fields) -> IMSVariant:
        for key, value in fields.items():
            setattr(variant, key, value)
        db.commit()
        db.refresh(variant)
        return variant

    @staticmethod
    def delete_variant(db: Session, variant: IMSVariant) -> None:
        db.delete(variant)
        db.commit()

    @staticmethod
    def variant_has_movements(db: Session, variant_id: str) -> bool:
        from shared_models import IMSStockMovement

        return (
            db.query(IMSStockMovement)
            .filter(IMSStockMovement.variant_id == variant_id)
            .first()
            is not None
        )

    @staticmethod
    def get_or_create_stock_row(db: Session, variant_id: str, branch_id: str) -> IMSVariantStock:
        row = (
            db.query(IMSVariantStock)
            .filter(IMSVariantStock.variant_id == variant_id, IMSVariantStock.branch_id == branch_id)
            .first()
        )
        if row:
            return row
        row = IMSVariantStock(variant_id=variant_id, branch_id=branch_id, qty=0)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def set_stock_qty(db: Session, row: IMSVariantStock, qty) -> IMSVariantStock:
        row.qty = qty
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def stock_for_variants(db: Session, variant_ids: list[str]) -> list[IMSVariantStock]:
        if not variant_ids:
            return []
        return (
            db.query(IMSVariantStock)
            .filter(IMSVariantStock.variant_id.in_(variant_ids))
            .all()
        )
