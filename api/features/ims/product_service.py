from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.ims.product_repository import IMSProductRepository
from features.ims.movement_repository import IMSMovementRepository
from features.ims.category_repository import IMSCategoryRepository
from features.branches.repository import BranchRepository
from utils.bikram_sambat import to_bs_iso
from utils.logger import logger


class IMSProductService:
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
    ) -> dict:
        items, total = IMSProductRepository.list_for_tenant(
            db, tenant_id, q, category_ids, brand_id, stock_status, offset, limit
        )
        return {"success": True, "products": items, "total": total}

    @staticmethod
    def get(db: Session, tenant_id: str, product_id: str) -> dict:
        product = IMSProductRepository.get_by_id(db, tenant_id, product_id)
        if not product:
            return {"success": False, "error_code": "PRODUCT_NOT_FOUND"}
        return {"success": True, "product": product}

    @staticmethod
    def delete(db: Session, tenant_id: str, product_id: str) -> dict:
        product = IMSProductRepository.get_by_id(db, tenant_id, product_id)
        if not product:
            return {"success": False, "error_code": "PRODUCT_NOT_FOUND"}
        IMSProductRepository.soft_delete(db, product)
        logger.info(f"IMS product deleted: {product_id}", extra={"tenant_id": tenant_id})
        return {"success": True}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id_for_stock: str,
        user_id: str,
        name: str,
        sku: str,
        category_id: str,
        brand_id: str | None,
        media_id: str | None,
        description: str | None,
        taxable: bool,
        tax_rate: Decimal | None,
        hs_code: str | None,
        variants: list[dict],
    ) -> dict:
        if not IMSCategoryRepository.get_by_id(db, tenant_id, category_id):
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}
        if branch_id_for_stock and not BranchRepository.get_by_id(db, tenant_id, branch_id_for_stock):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if IMSProductRepository.sku_exists(db, tenant_id, sku):
            return {"success": False, "error_code": "SKU_TAKEN"}
        if not variants:
            return {"success": False, "error_code": "VARIANTS_REQUIRED"}
        seen_barcodes: set[str] = set()
        for v in variants:
            barcode = (v.get("barcode") or "").strip()
            if not barcode:
                continue
            if barcode in seen_barcodes or IMSProductRepository.barcode_exists(db, tenant_id, barcode):
                return {"success": False, "error_code": "BARCODE_TAKEN", "barcode": barcode}
            seen_barcodes.add(barcode)

        try:
            product = IMSProductRepository.create(
                db,
                tenant_id=tenant_id,
                name=name.strip(),
                sku=sku.strip(),
                category_id=category_id,
                brand_id=brand_id,
                media_id=media_id,
                description=description,
                taxable=taxable,
                tax_rate=tax_rate,
                hs_code=hs_code,
            )
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "SKU_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"IMS product creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

        now = datetime.now(timezone.utc)
        for v in variants:
            variant = IMSProductRepository.add_variant(
                db,
                product.id,
                name=v.get("name") or "Default",
                model_no=v.get("model_no"),
                barcode=v.get("barcode"),
                unit_id=v["unit_id"],
                purchase_unit_id=v.get("purchase_unit_id"),
                conversion_factor=v.get("conversion_factor"),
                cost_price=v.get("cost_price") or 0,
                selling_price=v.get("selling_price") or 0,
                low_stock_at=v.get("low_stock_at") or 10,
                expiry_date=v.get("expiry_date"),
            )
            initial_stock = v.get("initial_stock") or 0
            if initial_stock and branch_id_for_stock:
                row = IMSProductRepository.get_or_create_stock_row(
                    db, variant.id, branch_id_for_stock
                )
                IMSProductRepository.set_stock_qty(db, row, initial_stock)
                IMSMovementRepository.create(
                    db,
                    tenant_id=tenant_id,
                    date=now,
                    date_bs=to_bs_iso(now) or "",
                    branch_id=branch_id_for_stock,
                    product_id=product.id,
                    variant_id=variant.id,
                    type="adjust-in",
                    qty=initial_stock,
                    unit_cost=variant.cost_price,
                    balance_after=initial_stock,
                    reason="Initial stock on product creation",
                    user_id=user_id,
                )

        logger.info(f"IMS product created: {product.id}", extra={"tenant_id": tenant_id, "sku": sku})
        return {"success": True, "product": IMSProductRepository.get_by_id(db, tenant_id, product.id)}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        product_id: str,
        name: str,
        sku: str,
        category_id: str,
        brand_id: str | None,
        media_id: str | None,
        description: str | None,
        taxable: bool,
        tax_rate: Decimal | None,
        hs_code: str | None,
        variants: list[dict],
    ) -> dict:
        product = IMSProductRepository.get_by_id(db, tenant_id, product_id)
        if not product:
            return {"success": False, "error_code": "PRODUCT_NOT_FOUND"}
        if not IMSCategoryRepository.get_by_id(db, tenant_id, category_id):
            return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}
        if IMSProductRepository.sku_exists(db, tenant_id, sku, exclude_id=product_id):
            return {"success": False, "error_code": "SKU_TAKEN"}
        if not variants:
            return {"success": False, "error_code": "VARIANTS_REQUIRED"}
        seen_barcodes: set[str] = set()
        for v in variants:
            barcode = (v.get("barcode") or "").strip()
            if not barcode:
                continue
            if barcode in seen_barcodes or IMSProductRepository.barcode_exists(
                db, tenant_id, barcode, exclude_variant_id=v.get("id")
            ):
                return {"success": False, "error_code": "BARCODE_TAKEN", "barcode": barcode}
            seen_barcodes.add(barcode)

        try:
            IMSProductRepository.update(
                db,
                product,
                name=name.strip(),
                sku=sku.strip(),
                category_id=category_id,
                brand_id=brand_id,
                media_id=media_id,
                description=description,
                taxable=taxable,
                tax_rate=tax_rate,
                hs_code=hs_code,
            )
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "SKU_TAKEN"}

        # Diff variants by id: existing rows (id present) are patched in
        # place so their stock/movement history survives; rows without an id
        # are new. Any existing variant not present in the payload is
        # deleted — but only if it has never moved stock, matching the
        # project's "line items soft-void, never delete" audit principle;
        # a variant with real movement history can't be deleted at all.
        existing_by_id = {v.id: v for v in product.variants}
        seen_ids: set[str] = set()

        for v in variants:
            vid = v.get("id")
            if vid and vid in existing_by_id:
                seen_ids.add(vid)
                IMSProductRepository.update_variant(
                    db,
                    existing_by_id[vid],
                    name=v.get("name") or "Default",
                    model_no=v.get("model_no"),
                    barcode=v.get("barcode"),
                    unit_id=v["unit_id"],
                    purchase_unit_id=v.get("purchase_unit_id"),
                    conversion_factor=v.get("conversion_factor"),
                    cost_price=v.get("cost_price") or 0,
                    selling_price=v.get("selling_price") or 0,
                    low_stock_at=v.get("low_stock_at") or 10,
                    expiry_date=v.get("expiry_date"),
                )
            else:
                IMSProductRepository.add_variant(
                    db,
                    product.id,
                    name=v.get("name") or "Default",
                    model_no=v.get("model_no"),
                    barcode=v.get("barcode"),
                    unit_id=v["unit_id"],
                    purchase_unit_id=v.get("purchase_unit_id"),
                    conversion_factor=v.get("conversion_factor"),
                    cost_price=v.get("cost_price") or 0,
                    selling_price=v.get("selling_price") or 0,
                    low_stock_at=v.get("low_stock_at") or 10,
                    expiry_date=v.get("expiry_date"),
                )

        for vid, variant in existing_by_id.items():
            if vid in seen_ids:
                continue
            if IMSProductRepository.variant_has_movements(db, vid):
                return {"success": False, "error_code": "VARIANT_HAS_HISTORY", "variant_name": variant.name}
            IMSProductRepository.delete_variant(db, variant)

        logger.info(f"IMS product updated: {product_id}", extra={"tenant_id": tenant_id})
        return {"success": True, "product": IMSProductRepository.get_by_id(db, tenant_id, product_id)}
