from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.table_repository import TableRepository, TABLE_STATUSES
from features.restro.zone_repository import ZoneRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


class TableService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def _assert_zone_in_branch(
        db: Session, tenant_id: str, branch_id: str, zone_id: str
    ) -> bool:
        zone = ZoneRepository.get_by_id(db, tenant_id, zone_id)
        return zone is not None and zone.is_active and zone.branch_id == branch_id

    @staticmethod
    def list_for_branch(
        db: Session,
        tenant_id: str,
        branch_id: str,
        zone_id: str | None = None,
    ) -> dict:
        if not TableService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        tables = TableRepository.list_for_branch(db, tenant_id, branch_id, zone_id)
        return {"success": True, "tables": tables}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        zone_id: str,
        label: str,
    ) -> dict:
        if not TableService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if not TableService._assert_zone_in_branch(db, tenant_id, branch_id, zone_id):
            return {"success": False, "error_code": "ZONE_NOT_FOUND"}

        try:
            table = TableRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                zone_id=zone_id,
                label=label,
            )
            logger.info(
                f"Table created: {table.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "label": label},
            )
            return {"success": True, "table": table}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "LABEL_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Table creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        table_id: str,
        label: str | None = None,
        zone_id: str | None = None,
        status: str | None = None,
    ) -> dict:
        table = TableRepository.get_by_id(db, tenant_id, table_id)
        if not table or not table.is_active or table.branch_id != branch_id:
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}

        if zone_id is not None and not TableService._assert_zone_in_branch(
            db, tenant_id, branch_id, zone_id
        ):
            return {"success": False, "error_code": "ZONE_NOT_FOUND"}

        if status is not None and status not in TABLE_STATUSES:
            return {"success": False, "error_code": "INVALID_STATUS"}

        try:
            updated = TableRepository.update(
                db, table, label=label, zone_id=zone_id, status=status
            )
            return {"success": True, "table": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "LABEL_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Table update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str, table_id: str) -> dict:
        table = TableRepository.get_by_id(db, tenant_id, table_id)
        if not table or not table.is_active or table.branch_id != branch_id:
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}
        if table.status != "empty":
            return {"success": False, "error_code": "TABLE_NOT_EMPTY"}
        # If it's part of a merge group, clear the group's merge_id first so
        # remaining tables in the group are not left dangling.
        if table.merge_id:
            group = TableRepository.list_in_merge_group(db, tenant_id, table.merge_id)
            TableRepository.clear_merge(db, group)
        TableRepository.update(db, table, is_active=False)
        logger.info(f"Table deactivated: {table_id}", extra={"tenant_id": tenant_id})
        return {"success": True}

    @staticmethod
    def reserve(
        db: Session,
        tenant_id: str,
        branch_id: str,
        table_id: str,
        guest_name: str,
        phone: str | None,
        date_val: date,
        time: str,
        party_size: int,
    ) -> dict:
        table = TableRepository.get_by_id(db, tenant_id, table_id)
        if not table or not table.is_active or table.branch_id != branch_id:
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}
        if table.status == "occupied":
            return {"success": False, "error_code": "TABLE_OCCUPIED"}
        if not guest_name.strip():
            return {"success": False, "error_code": "GUEST_NAME_REQUIRED"}
        if party_size < 1:
            return {"success": False, "error_code": "INVALID_PARTY_SIZE"}
        updated = TableRepository.set_reservation(
            db, table, guest_name, phone, date_val, time, party_size
        )
        logger.info(f"Table reserved: {table_id}", extra={"tenant_id": tenant_id})
        return {"success": True, "table": updated}

    @staticmethod
    def clear_reservation(
        db: Session, tenant_id: str, branch_id: str, table_id: str
    ) -> dict:
        table = TableRepository.get_by_id(db, tenant_id, table_id)
        if not table or not table.is_active or table.branch_id != branch_id:
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}
        if not table.reservation_guest_name:
            return {"success": False, "error_code": "NO_RESERVATION"}
        updated = TableRepository.clear_reservation(db, table)
        return {"success": True, "table": updated}

    @staticmethod
    def merge(
        db: Session, tenant_id: str, branch_id: str, table_ids: list[str]
    ) -> dict:
        if len(table_ids) < 2:
            return {"success": False, "error_code": "MERGE_NEEDS_TWO"}
        tables = TableRepository.get_many_by_ids(db, tenant_id, table_ids)
        if len(tables) != len(set(table_ids)):
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}
        # All must be in this branch and share one zone.
        if any(t.branch_id != branch_id for t in tables):
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}
        zones = {t.zone_id for t in tables}
        if len(zones) != 1:
            return {"success": False, "error_code": "MERGE_CROSS_ZONE"}
        # Refuse merging tables already part of a different merge group — user
        # must unmerge them first (keeps merge semantics clean).
        if any(t.merge_id for t in tables):
            return {"success": False, "error_code": "TABLE_ALREADY_MERGED"}

        merge_id = TableRepository.new_merge_id()
        TableRepository.apply_merge(db, tables, merge_id)
        logger.info(
            f"Tables merged: {table_ids} -> {merge_id}",
            extra={"tenant_id": tenant_id, "branch_id": branch_id},
        )
        return {"success": True, "tables": tables, "merge_id": merge_id}

    @staticmethod
    def unmerge(
        db: Session, tenant_id: str, branch_id: str, table_id: str
    ) -> dict:
        table = TableRepository.get_by_id(db, tenant_id, table_id)
        if not table or not table.is_active or table.branch_id != branch_id:
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}
        if not table.merge_id:
            return {"success": False, "error_code": "NOT_MERGED"}
        group = TableRepository.list_in_merge_group(db, tenant_id, table.merge_id)
        TableRepository.clear_merge(db, group)
        logger.info(
            f"Tables unmerged from group of {len(group)}",
            extra={"tenant_id": tenant_id, "branch_id": branch_id},
        )
        return {"success": True, "tables": group}
