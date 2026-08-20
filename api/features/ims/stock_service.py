from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from features.ims.product_repository import IMSProductRepository
from features.ims.movement_repository import IMSMovementRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


class IMSStockService:
    @staticmethod
    def adjust(
        db: Session,
        tenant_id: str,
        variant_id: str,
        branch_id: str,
        qty: Decimal,
        reason: str,
        date: datetime,
        user_id: str,
    ) -> dict:
        variant = IMSProductRepository.get_variant(db, tenant_id, variant_id)
        if not variant:
            return {"success": False, "error_code": "VARIANT_NOT_FOUND"}
        if not BranchRepository.get_by_id(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        row = IMSProductRepository.get_or_create_stock_row(db, variant_id, branch_id)
        balance = row.qty + qty
        IMSProductRepository.set_stock_qty(db, row, balance)

        movement = IMSMovementRepository.create(
            db,
            tenant_id=tenant_id,
            date=date,
            branch_id=branch_id,
            product_id=variant.product_id,
            variant_id=variant_id,
            type="adjust-in" if qty >= 0 else "adjust-out",
            qty=qty,
            balance_after=balance,
            reason=reason,
            user_id=user_id,
        )
        logger.info(
            f"IMS stock adjusted: variant={variant_id} qty={qty}",
            extra={"tenant_id": tenant_id, "branch_id": branch_id},
        )
        return {"success": True, "movement": movement, "balance": balance}

    @staticmethod
    def restock(
        db: Session,
        tenant_id: str,
        variant_id: str,
        branch_id: str,
        qty: Decimal,
        unit_cost: Decimal,
        date: datetime,
        user_id: str,
        supplier_id: str | None = None,
        reference: str | None = None,
    ) -> dict:
        variant = IMSProductRepository.get_variant(db, tenant_id, variant_id)
        if not variant:
            return {"success": False, "error_code": "VARIANT_NOT_FOUND"}
        if not BranchRepository.get_by_id(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if qty <= 0:
            return {"success": False, "error_code": "INVALID_QTY"}

        row = IMSProductRepository.get_or_create_stock_row(db, variant_id, branch_id)
        balance = row.qty + qty
        IMSProductRepository.set_stock_qty(db, row, balance)
        IMSProductRepository.update_variant(db, variant, cost_price=unit_cost)

        movement = IMSMovementRepository.create(
            db,
            tenant_id=tenant_id,
            date=date,
            branch_id=branch_id,
            product_id=variant.product_id,
            variant_id=variant_id,
            type="restock",
            qty=qty,
            unit_cost=unit_cost,
            balance_after=balance,
            reference=reference,
            supplier_id=supplier_id,
            user_id=user_id,
        )
        logger.info(
            f"IMS restock: variant={variant_id} qty={qty}",
            extra={"tenant_id": tenant_id, "branch_id": branch_id},
        )
        return {"success": True, "movement": movement, "balance": balance}

    @staticmethod
    def list_movements(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        variant_id: str | None,
        type_: str | None,
        q: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        offset: int,
        limit: int,
    ) -> dict:
        items, total = IMSMovementRepository.list_for_tenant(
            db, tenant_id, branch_id, variant_id, type_, q, date_from, date_to, offset, limit
        )
        return {"success": True, "movements": items, "total": total}
