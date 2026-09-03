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
    def get_by_id(
        db: Session, tenant_id: str, product_id: str, include_inactive: bool = False
    ) -> IMSProduct | None:
        query = db.query(IMSProduct).filter(
            IMSProduct.id == product_id, IMSProduct.tenant_id == tenant_id
        )
        if not include_inactive:
            query = query.filter(IMSProduct.is_active == True)
        return query.options(
            joinedload(IMSProduct.variants).joinedload(IMSVariant.stock_rows)
        ).first()

    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        q: str | None,
        category_ids: list[str] | None,
        brand_id: str | None,
        stock_status: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[IMSProduct], int]:
        from sqlalchemy import func, or_
        from shared_models import IMSVariantStock

        query = (
            db.query(IMSProduct)
            .options(joinedload(IMSProduct.variants).joinedload(IMSVariant.stock_rows))
            .filter(IMSProduct.tenant_id == tenant_id, IMSProduct.is_active == True)
        )
        if category_ids:
            query = query.filter(IMSProduct.category_id.in_(category_ids))
        if brand_id:
            query = query.filter(IMSProduct.brand_id == brand_id)
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.outerjoin(IMSVariant, IMSVariant.product_id == IMSProduct.id).filter(
                or_(
                    func.lower(IMSProduct.name).like(term),
                    func.lower(IMSProduct.sku).like(term),
                    func.lower(IMSVariant.name).like(term),
                    func.lower(IMSVariant.model_no).like(term),
                    func.lower(IMSVariant.barcode).like(term),
                )
            )
        if stock_status:
            # Correlated subquery: total on-hand qty across every branch for
            # each product's variants, and the lowest low_stock_at threshold
            # among them — matches the frontend's statusOf() semantics
            # (out: total<=0, low: any variant at/under its own threshold).
            # Pattern matches hotel_pms/booking_repository.py's overlap
            # check: call .exists() on the Query itself, not the standalone
            # exists() function — that expects a Select/ScalarSelect, not a
            # legacy Query object.
            stock_sub = (
                db.query(func.coalesce(func.sum(IMSVariantStock.qty), 0))
                .join(IMSVariant, IMSVariant.id == IMSVariantStock.variant_id)
                .filter(IMSVariant.product_id == IMSProduct.id)
                .correlate(IMSProduct)
                .scalar_subquery()
            )
            low_exists = (
                db.query(IMSVariant.id)
                .outerjoin(IMSVariantStock, IMSVariantStock.variant_id == IMSVariant.id)
                .filter(
                    IMSVariant.product_id == IMSProduct.id,
                    func.coalesce(IMSVariantStock.qty, 0) <= IMSVariant.low_stock_at,
                )
                .correlate(IMSProduct)
                .exists()
            )
            if stock_status == "out":
                query = query.filter(stock_sub <= 0)
            elif stock_status == "low":
                query = query.filter(stock_sub > 0, low_exists)
            elif stock_status == "in-stock":
                query = query.filter(stock_sub > 0, ~low_exists)
        total = query.distinct().count()
        items = (
            query.distinct()
            .order_by(IMSProduct.name)
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
        # Only active products hold the SKU — matches the partial unique
        # index, so a soft-deleted product's SKU is free to reuse.
        query = db.query(IMSProduct).filter(
            IMSProduct.tenant_id == tenant_id,
            IMSProduct.sku == sku,
            IMSProduct.is_active == True,
        )
        if exclude_id:
            query = query.filter(IMSProduct.id != exclude_id)
        return query.first() is not None

    @staticmethod
    def barcode_exists(
        db: Session, tenant_id: str, barcode: str, exclude_variant_id: str | None = None
    ) -> bool:
        # barcode has no DB-level unique constraint (it lives on IMSVariant,
        # which has no tenant_id column of its own — a partial unique index
        # can't span the join to IMSProduct), so uniqueness is enforced here
        # at the app layer instead, same pattern as sku_exists above. Scoped
        # per-tenant: two different businesses reusing the same manufacturer
        # barcode is fine, only a collision within one tenant's own catalogue
        # is a real problem.
        query = (
            db.query(IMSVariant)
            .join(IMSProduct, IMSVariant.product_id == IMSProduct.id)
            .filter(
                IMSProduct.tenant_id == tenant_id,
                IMSProduct.is_active == True,
                IMSVariant.barcode == barcode,
            )
        )
        if exclude_variant_id:
            query = query.filter(IMSVariant.id != exclude_variant_id)
        return query.first() is not None

    @staticmethod
    def soft_delete(db: Session, product: IMSProduct) -> None:
        product.is_active = False
        db.commit()

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
            .options(joinedload(IMSVariant.stock_rows), joinedload(IMSVariant.product))
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
