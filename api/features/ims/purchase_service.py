from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from features.ims.purchase_repository import IMSPurchaseRepository
from features.ims.product_repository import IMSProductRepository
from features.ims.category_repository import IMSCategoryRepository
from features.ims.party_repository import IMSPartyRepository
from features.ims.fiscal_year_service import IMSFiscalYearService
from features.branches.repository import BranchRepository
from features.ims import purchase_txn_helpers as txn
from utils.bikram_sambat import to_bs_iso
from utils.logger import logger


class IMSPurchaseService:
    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        party_id: str | None,
        q: str | None,
        bs_from: str | None,
        bs_to: str | None,
        offset: int,
        limit: int,
    ) -> dict:
        items, total = IMSPurchaseRepository.list_for_tenant(
            db, tenant_id, branch_id, party_id, q, bs_from, bs_to, offset, limit
        )
        return {"success": True, "purchases": items, "total": total}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        user_id: str,
        date: datetime,
        branch_id: str,
        party_id: str | None,
        bill_no: str | None,
        note: str | None,
        bill_amount: Decimal,
        paid_amount: Decimal,
        payment_method: str,
        post_to_ledger: bool,
        items: list[dict],
        default_vat_rate: Decimal,
    ) -> dict:
        if not BranchRepository.get_by_id(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if party_id and not IMSPartyRepository.get_by_id(db, tenant_id, party_id):
            return {"success": False, "error_code": "PARTY_NOT_FOUND"}
        if not items:
            return {"success": False, "error_code": "NO_ITEMS"}

        fy_result = IMSFiscalYearService.get_active(db, tenant_id)
        start_year = fy_result["fiscal_year"].start_year if fy_result["success"] else datetime.now().year

        try:
            seq = IMSPurchaseRepository.count_for_tenant(db, tenant_id) + 1
            number = f"PB-{start_year}-{1000 + seq}"
            date_bs = to_bs_iso(date) or ""

            purchase = IMSPurchaseRepository.create(
                db,
                tenant_id=tenant_id,
                number=number,
                date=date,
                date_bs=date_bs,
                branch_id=branch_id,
                party_id=party_id,
                bill_no=bill_no,
                items_total=Decimal(0),
                bill_amount=bill_amount,
                paid_amount=paid_amount,
                payment_method=payment_method,
                post_to_ledger=post_to_ledger,
                note=note,
                user_id=user_id,
            )

            items_total = Decimal(0)
            lines_written = 0
            reference = bill_no or number

            for item in items:
                if item["kind"] == "new":
                    if not IMSCategoryRepository.get_by_id(db, tenant_id, item["category_id"]):
                        db.rollback()
                        return {"success": False, "error_code": "CATEGORY_NOT_FOUND"}
                    if IMSProductRepository.sku_exists(db, tenant_id, item["sku"]):
                        db.rollback()
                        return {"success": False, "error_code": "SKU_TAKEN", "sku": item["sku"]}

                    product = txn.create_product(
                        db,
                        tenant_id=tenant_id,
                        name=item["name"].strip(),
                        sku=item["sku"].strip(),
                        category_id=item["category_id"],
                        brand_id=item.get("brand_id"),
                        media_id=item.get("media_id"),
                        description=None,
                        taxable=item["taxable"],
                        tax_rate=item.get("tax_rate"),
                    )
                    taxable = item["taxable"]
                    rate = (item.get("tax_rate") or default_vat_rate) if taxable else Decimal(0)

                    for row in item["rows"]:
                        variant = txn.add_variant(
                            db,
                            product.id,
                            name=row.get("name") or "Default",
                            model_no=row.get("model_no"),
                            barcode=row.get("barcode"),
                            unit_id=row["unit_id"],
                            cost_price=row["unit_cost"],
                            selling_price=row.get("selling_price") or 0,
                            low_stock_at=row.get("low_stock_at") or 10,
                        )
                        qty = row["qty"]
                        line_amount = qty * row["unit_cost"]
                        vat_amount = (line_amount * rate) / 100 if taxable else Decimal(0)
                        items_total += line_amount
                        IMSPurchaseRepository.add_line(
                            db,
                            purchase_id=purchase.id,
                            product_id=product.id,
                            variant_id=variant.id,
                            description=f"{item['name']} — {row.get('name') or 'Default'}",
                            qty=qty,
                            unit_id=row["unit_id"],
                            unit_cost=row["unit_cost"],
                            taxable=taxable,
                            tax_rate=rate,
                            vat_amount=vat_amount,
                        )
                        lines_written += 1
                        if qty > 0:
                            stock_row = txn.get_or_create_stock_row(db, variant.id, branch_id)
                            balance = stock_row.qty + qty
                            txn.set_stock_qty(db, stock_row, balance)
                            txn.create_movement(
                                db,
                                tenant_id=tenant_id,
                                date=date,
                                date_bs=date_bs,
                                branch_id=branch_id,
                                product_id=product.id,
                                variant_id=variant.id,
                                type="restock",
                                qty=qty,
                                unit_cost=row["unit_cost"],
                                balance_after=balance,
                                reference=reference,
                                supplier_id=party_id,
                                user_id=user_id,
                            )
                else:  # existing product
                    product = IMSProductRepository.get_by_id(db, tenant_id, item["product_id"])
                    if not product:
                        db.rollback()
                        return {"success": False, "error_code": "PRODUCT_NOT_FOUND"}
                    taxable = product.taxable is not False
                    rate = (product.tax_rate or default_vat_rate) if taxable else Decimal(0)

                    for row in item["rows"]:
                        variant = IMSProductRepository.get_variant(db, tenant_id, row["variant_id"])
                        qty = row["qty"]
                        if not variant or qty <= 0:
                            continue
                        txn.update_variant(
                            db,
                            variant,
                            cost_price=row["unit_cost"],
                            selling_price=row.get("selling_price") or variant.selling_price,
                        )
                        line_amount = qty * row["unit_cost"]
                        vat_amount = (line_amount * rate) / 100 if taxable else Decimal(0)
                        items_total += line_amount
                        IMSPurchaseRepository.add_line(
                            db,
                            purchase_id=purchase.id,
                            product_id=variant.product_id,
                            variant_id=variant.id,
                            description=f"{product.name} — {variant.name}",
                            qty=qty,
                            unit_id=variant.unit_id,
                            unit_cost=row["unit_cost"],
                            taxable=taxable,
                            tax_rate=rate,
                            vat_amount=vat_amount,
                        )
                        lines_written += 1
                        stock_row = txn.get_or_create_stock_row(db, variant.id, branch_id)
                        balance = stock_row.qty + qty
                        txn.set_stock_qty(db, stock_row, balance)
                        txn.create_movement(
                            db,
                            tenant_id=tenant_id,
                            date=date,
                            date_bs=date_bs,
                            branch_id=branch_id,
                            product_id=variant.product_id,
                            variant_id=variant.id,
                            type="restock",
                            qty=qty,
                            unit_cost=row["unit_cost"],
                            balance_after=balance,
                            reference=reference,
                            supplier_id=party_id,
                            user_id=user_id,
                        )

            if lines_written == 0:
                db.rollback()
                return {"success": False, "error_code": "NO_ITEMS"}

            purchase.items_total = items_total

            if party_id and post_to_ledger:
                if bill_amount and bill_amount > 0:
                    txn.create_ledger_entry(
                        db,
                        tenant_id=tenant_id,
                        party_id=party_id,
                        date=date,
                        description=f"Purchase bill {reference}",
                        reference=reference,
                        debit=Decimal(0),
                        credit=bill_amount,
                    )
                if paid_amount and paid_amount > 0:
                    txn.create_ledger_entry(
                        db,
                        tenant_id=tenant_id,
                        party_id=party_id,
                        date=date,
                        description=f"Payment made ({payment_method})",
                        reference=reference,
                        debit=paid_amount,
                        credit=Decimal(0),
                    )

            db.commit()
            db.refresh(purchase)
        except Exception as e:
            db.rollback()
            logger.error(f"IMS purchase creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

        logger.info(f"IMS purchase created: {purchase.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "purchase": IMSPurchaseRepository.get_by_id(db, tenant_id, purchase.id)}
