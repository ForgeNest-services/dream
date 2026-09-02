from datetime import datetime
from sqlalchemy.orm import Session
from shared_models import AuditLog


class AuditRepository:

    @staticmethod
    def write(
        db: Session,
        *,
        tenant_id: str,
        app_code: str,
        entity_type: str,
        entity_id: str,
        action: str,
        performed_by: str,
        performer_type: str,
        before_state: dict | None = None,
        after_state: dict | None = None,
        reason: str | None = None,
        terminal_ip: str | None = None,
        mac_address: str | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            tenant_id=tenant_id,
            app_code=app_code,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by=performed_by,
            performer_type=performer_type,
            before_state=before_state,
            after_state=after_state,
            reason=reason,
            terminal_ip=terminal_ip,
            mac_address=mac_address,
        )
        db.add(entry)
        db.flush()
        return entry

    @staticmethod
    def list_for_entity(
        db: Session,
        tenant_id: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        q = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
        if entity_type:
            q = q.filter(AuditLog.entity_type == entity_type)
        if entity_id:
            q = q.filter(AuditLog.entity_id == entity_id)
        total = q.count()
        rows = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        return rows, total

    @staticmethod
    def list_for_app(
        db: Session,
        tenant_id: str,
        app_code: str,
        entity_type: str | None = None,
        action: str | None = None,
        performed_by: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        q: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AuditLog], int]:
        """IRD: Electronic Billing Procedure 2082, clause 6.3ग — the User
        Activity Log must be viewable/filterable from the front-end. This
        backs that viewer, scoped to one app's audit rows for one tenant.
        AuditLog has no date_bs snapshot column (unlike invoices/orders) —
        date_from/date_to are plain AD datetimes, converted from whatever
        the caller's UI collects."""
        query = db.query(AuditLog).filter(
            AuditLog.tenant_id == tenant_id, AuditLog.app_code == app_code
        )
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if action:
            query = query.filter(AuditLog.action == action)
        if performed_by:
            query = query.filter(AuditLog.performed_by == performed_by)
        if date_from:
            query = query.filter(AuditLog.created_at >= date_from)
        if date_to:
            query = query.filter(AuditLog.created_at <= date_to)
        if q:
            like = f"%{q}%"
            query = query.filter(
                (AuditLog.entity_id.ilike(like))
                | (AuditLog.performed_by.ilike(like))
                | (AuditLog.reason.ilike(like))
            )
        total = query.count()
        rows = (
            query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        )
        return rows, total
