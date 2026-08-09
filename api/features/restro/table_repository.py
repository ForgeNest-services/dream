from datetime import date
import uuid
from sqlalchemy.orm import Session
from shared_models import RestroTable


TABLE_STATUSES = {"empty", "occupied", "reserved"}


class TableRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        zone_id: str,
        label: str,
        status: str = "empty",
    ) -> RestroTable:
        table = RestroTable(
            tenant_id=tenant_id,
            branch_id=branch_id,
            zone_id=zone_id,
            label=label.strip(),
            status=status,
        )
        db.add(table)
        db.commit()
        db.refresh(table)
        return table

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, table_id: str) -> RestroTable | None:
        return (
            db.query(RestroTable)
            .filter(RestroTable.id == table_id, RestroTable.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def get_many_by_ids(
        db: Session, tenant_id: str, table_ids: list[str]
    ) -> list[RestroTable]:
        if not table_ids:
            return []
        return (
            db.query(RestroTable)
            .filter(
                RestroTable.tenant_id == tenant_id,
                RestroTable.id.in_(table_ids),
                RestroTable.is_active == True,
            )
            .all()
        )

    @staticmethod
    def list_for_branch(
        db: Session,
        tenant_id: str,
        branch_id: str,
        zone_id: str | None = None,
    ) -> list[RestroTable]:
        q = db.query(RestroTable).filter(
            RestroTable.tenant_id == tenant_id,
            RestroTable.branch_id == branch_id,
            RestroTable.is_active == True,
        )
        if zone_id:
            q = q.filter(RestroTable.zone_id == zone_id)
        return q.order_by(RestroTable.zone_id, RestroTable.label).all()

    @staticmethod
    def list_in_merge_group(
        db: Session, tenant_id: str, merge_id: str
    ) -> list[RestroTable]:
        return (
            db.query(RestroTable)
            .filter(
                RestroTable.tenant_id == tenant_id,
                RestroTable.merge_id == merge_id,
                RestroTable.is_active == True,
            )
            .all()
        )

    @staticmethod
    def has_active_tables_in_zone(
        db: Session, tenant_id: str, zone_id: str
    ) -> bool:
        return (
            db.query(RestroTable)
            .filter(
                RestroTable.tenant_id == tenant_id,
                RestroTable.zone_id == zone_id,
                RestroTable.is_active == True,
            )
            .first()
            is not None
        )

    @staticmethod
    def update(
        db: Session,
        table: RestroTable,
        label: str | None = None,
        zone_id: str | None = None,
        status: str | None = None,
        is_active: bool | None = None,
    ) -> RestroTable:
        if label is not None:
            table.label = label.strip()
        if zone_id is not None:
            table.zone_id = zone_id
        if status is not None:
            table.status = status
        if is_active is not None:
            table.is_active = is_active
        db.commit()
        db.refresh(table)
        return table

    @staticmethod
    def set_reservation(
        db: Session,
        table: RestroTable,
        guest_name: str,
        phone: str | None,
        date_val: date,
        time: str,
        party_size: int,
    ) -> RestroTable:
        table.reservation_guest_name = guest_name.strip()
        table.reservation_phone = phone.strip() if phone else None
        table.reservation_date = date_val
        table.reservation_time = time
        table.reservation_party_size = party_size
        table.status = "reserved"
        db.commit()
        db.refresh(table)
        return table

    @staticmethod
    def clear_reservation(db: Session, table: RestroTable) -> RestroTable:
        table.reservation_guest_name = None
        table.reservation_phone = None
        table.reservation_date = None
        table.reservation_time = None
        table.reservation_party_size = None
        # Only revert to empty if we were in the reserved state — if the guest
        # already sat down and status flipped to occupied, don't clobber it.
        if table.status == "reserved":
            table.status = "empty"
        db.commit()
        db.refresh(table)
        return table

    @staticmethod
    def apply_merge(
        db: Session, tables: list[RestroTable], merge_id: str
    ) -> list[RestroTable]:
        for t in tables:
            t.merge_id = merge_id
        db.commit()
        for t in tables:
            db.refresh(t)
        return tables

    @staticmethod
    def clear_merge(db: Session, tables: list[RestroTable]) -> list[RestroTable]:
        for t in tables:
            t.merge_id = None
        db.commit()
        for t in tables:
            db.refresh(t)
        return tables

    @staticmethod
    def new_merge_id() -> str:
        return str(uuid.uuid4())
