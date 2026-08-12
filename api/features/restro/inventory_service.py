from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.inventory_repository import InventoryRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


ALLOWED_UNITS = {"kg", "liter", "piece", "packet"}


class InventoryService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def _assert_item(db: Session, tenant_id: str, branch_id: str, item_id: str):
        item = InventoryRepository.get_by_id(db, tenant_id, item_id)
        if not item or not item.is_active or item.branch_id != branch_id:
            return None
        return item

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> dict:
        if not InventoryService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        items = InventoryRepository.list_for_branch(db, tenant_id, branch_id)
        return {"success": True, "items": items}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        category: str,
        unit: str,
        threshold: Decimal,
        stock: Decimal,
        actor_name: str,
        actor_cred_id: str | None,
    ) -> dict:
        if not InventoryService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if unit not in ALLOWED_UNITS:
            return {"success": False, "error_code": "INVALID_UNIT"}
        if threshold < 0:
            return {"success": False, "error_code": "INVALID_THRESHOLD"}
        if stock < 0:
            return {"success": False, "error_code": "INVALID_STOCK"}
        try:
            item = InventoryRepository.create(
                db, tenant_id, branch_id, name, category, unit, threshold
            )
            # Record opening balance as its own movement so the history reads as
            # "Initial stock: +N" rather than a phantom starting quantity.
            if stock > 0:
                item, _ = InventoryRepository.apply_delta(
                    db,
                    item,
                    stock,
                    movement_type="restock",
                    reason="Initial stock",
                    note=None,
                    cost=None,
                    actor_name=actor_name,
                    actor_cred_id=actor_cred_id,
                    clamp_zero=False,
                )
            logger.info(
                f"Inventory item created: {item.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "name": name},
            )
            return {"success": True, "item": item}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Inventory create failed: {e}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        item_id: str,
        name: str | None,
        category: str | None,
        unit: str | None,
        threshold: Decimal | None,
    ) -> dict:
        item = InventoryService._assert_item(db, tenant_id, branch_id, item_id)
        if not item:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}
        if unit is not None and unit not in ALLOWED_UNITS:
            return {"success": False, "error_code": "INVALID_UNIT"}
        if threshold is not None and threshold < 0:
            return {"success": False, "error_code": "INVALID_THRESHOLD"}
        try:
            updated = InventoryRepository.update(
                db, item, name=name, category=category, unit=unit, threshold=threshold
            )
            return {"success": True, "item": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "NAME_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Inventory update failed: {e}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str, item_id: str) -> dict:
        item = InventoryService._assert_item(db, tenant_id, branch_id, item_id)
        if not item:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}
        InventoryRepository.update(db, item, is_active=False)
        return {"success": True}

    @staticmethod
    def restock(
        db: Session,
        tenant_id: str,
        branch_id: str,
        item_id: str,
        qty: Decimal,
        cost: Decimal | None,
        note: str | None,
        actor_name: str,
        actor_cred_id: str | None,
    ) -> dict:
        if qty <= 0:
            return {"success": False, "error_code": "INVALID_QTY"}
        if cost is not None and cost < 0:
            return {"success": False, "error_code": "INVALID_COST"}
        item = InventoryService._assert_item(db, tenant_id, branch_id, item_id)
        if not item:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}
        item, movement = InventoryRepository.apply_delta(
            db,
            item,
            qty,
            movement_type="restock",
            reason="Restock",
            note=note,
            cost=cost,
            actor_name=actor_name,
            actor_cred_id=actor_cred_id,
            clamp_zero=False,
        )
        return {"success": True, "item": item, "movement": movement}

    @staticmethod
    def adjust(
        db: Session,
        tenant_id: str,
        branch_id: str,
        item_id: str,
        delta: Decimal,
        reason: str,
        note: str | None,
        actor_name: str,
        actor_cred_id: str | None,
    ) -> dict:
        if delta == 0:
            return {"success": False, "error_code": "INVALID_DELTA"}
        if not reason or not reason.strip():
            return {"success": False, "error_code": "REASON_REQUIRED"}
        item = InventoryService._assert_item(db, tenant_id, branch_id, item_id)
        if not item:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}
        item, movement = InventoryRepository.apply_delta(
            db,
            item,
            delta,
            movement_type="adjust",
            reason=reason.strip(),
            note=note,
            cost=None,
            actor_name=actor_name,
            actor_cred_id=actor_cred_id,
            clamp_zero=True,
        )
        return {"success": True, "item": item, "movement": movement}

    @staticmethod
    def list_movements(
        db: Session,
        tenant_id: str,
        branch_id: str,
        item_id: str,
        limit: int = 200,
    ) -> dict:
        item = InventoryService._assert_item(db, tenant_id, branch_id, item_id)
        if not item:
            return {"success": False, "error_code": "ITEM_NOT_FOUND"}
        movements = InventoryRepository.list_movements(db, tenant_id, item_id, limit)
        return {"success": True, "movements": movements}
