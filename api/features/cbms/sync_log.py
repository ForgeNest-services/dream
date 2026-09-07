import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from shared_models.cbms_sync_log import CbmsSyncLog


class CbmsSyncLogRepository:
    @staticmethod
    def get_or_create_pending(
        db: Session,
        tenant_id: str,
        source_app: str,
        document_type: str,
        document_id: str,
        document_number: str | None,
    ) -> CbmsSyncLog:
        """One log row per document — reused across retries (attempt_count
        increments), not a fresh row per attempt. A document already marked
        `synced` is returned as-is without resetting its state; the caller
        (sync job) checks status before doing any network call so a
        double-enqueue can't re-submit an already-synced document."""
        row = (
            db.query(CbmsSyncLog)
            .filter(
                CbmsSyncLog.source_app == source_app,
                CbmsSyncLog.document_id == document_id,
            )
            .first()
        )
        if row:
            return row
        row = CbmsSyncLog(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            source_app=source_app,
            document_type=document_type,
            document_id=document_id,
            document_number=document_number,
            status="pending",
        )
        db.add(row)
        db.flush()
        return row

    @staticmethod
    def record_attempt(
        db: Session,
        row: CbmsSyncLog,
        status: str,
        cbms_response_code: str | None,
        cbms_response_body: str | None,
    ) -> CbmsSyncLog:
        row.attempt_count = (row.attempt_count or 0) + 1
        row.last_attempted_at = datetime.now(timezone.utc)
        row.status = status
        row.cbms_response_code = cbms_response_code
        row.cbms_response_body = cbms_response_body
        if status == "synced":
            row.synced_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        source_app: str | None,
        status: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[CbmsSyncLog], int]:
        query = db.query(CbmsSyncLog).filter(CbmsSyncLog.tenant_id == tenant_id)
        if source_app:
            query = query.filter(CbmsSyncLog.source_app == source_app)
        if status:
            query = query.filter(CbmsSyncLog.status == status)
        total = query.count()
        items = (
            query.order_by(CbmsSyncLog.last_attempted_at.desc().nullslast())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, log_id: str) -> CbmsSyncLog | None:
        return (
            db.query(CbmsSyncLog)
            .filter(CbmsSyncLog.id == log_id, CbmsSyncLog.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def summary_for_tenant(db: Session, tenant_id: str) -> dict:
        """Powers the admin tax-settings page's combined IMS+RMS summary:
        last synced timestamp overall, and pending/failed counts."""
        rows = db.query(CbmsSyncLog).filter(CbmsSyncLog.tenant_id == tenant_id).all()
        pending = sum(1 for r in rows if r.status == "pending")
        failed = sum(1 for r in rows if r.status == "failed")
        synced_ats = [r.synced_at for r in rows if r.synced_at]
        last_synced_at = max(synced_ats) if synced_ats else None
        return {
            "pending": pending,
            "failed": failed,
            "last_synced_at": last_synced_at.isoformat() if last_synced_at else None,
        }
