from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, require_role
from utils.helpers import success_response, error_response
from utils.paging import parse_paging, build_meta
from features.tax_settings.service import TaxSettingsService
from features.tax_settings.schemas import SaveCredentialsRequest, SetSyncEnabledRequest
from features.cbms.sync_log import CbmsSyncLogRepository

router = APIRouter(prefix="/tax-settings", tags=["Tax Settings"])

owner_dep = [Depends(require_tenant_user)]


@router.get("", dependencies=owner_dep)
def get_tax_settings(
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = TaxSettingsService.get(db, user.tenant_id)
    return success_response(data=result)


@router.put("/credentials", dependencies=owner_dep)
def save_tax_credentials(
    body: SaveCredentialsRequest,
    current_user: dict = Depends(require_role(["owner"])),
    db: Session = Depends(get_db),
):
    """Owner-only — this is the single shared entry point for the org's
    IRD Taxpayer Portal login (docs/Srota_IRD_Compliance_Checklist.md:
    "Same settings screen as IMS reads from — no separate RMS-only
    credential entry"). SaveCredentialsRequest.consent must be explicitly
    true (Pydantic validator rejects false/missing)."""
    user = current_user["user"]
    result = TaxSettingsService.save_credentials(
        db, user.tenant_id, body.ird_username, body.ird_password
    )
    if not result["success"]:
        code = result["error_code"]
        if code == "NOT_VAT_REGISTERED":
            return error_response(
                code, "CBMS sync only applies to VAT-registered businesses.", 400
            )
        return error_response(code, "Failed to save tax settings", 400)
    return success_response(data={"saved": True})


@router.patch("/sync-enabled", dependencies=owner_dep)
def set_sync_enabled(
    body: SetSyncEnabledRequest,
    current_user: dict = Depends(require_role(["owner"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    result = TaxSettingsService.set_sync_enabled(db, user.tenant_id, body.enabled)
    if not result["success"]:
        code = result["error_code"]
        if code == "CREDENTIALS_NOT_SAVED":
            return error_response(code, "Save IRD credentials before enabling sync", 400)
        if code == "NOT_VAT_REGISTERED":
            return error_response(
                code, "CBMS sync only applies to VAT-registered businesses.", 400
            )
        return error_response(code, "Failed to update sync setting", 400)
    return success_response(data={"cbms_sync_enabled": result["settings"].cbms_sync_enabled})


@router.get("/sync-log", dependencies=owner_dep)
def list_sync_log(
    app: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 25,
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    user = current_user["user"]
    paging = parse_paging(page, per_page)
    items, total = CbmsSyncLogRepository.list_for_tenant(
        db, user.tenant_id, app, status, paging["offset"], paging["limit"]
    )
    data = [
        {
            "id": r.id,
            "source_app": r.source_app,
            "document_type": r.document_type,
            "document_id": r.document_id,
            "document_number": r.document_number,
            "status": r.status,
            "cbms_response_code": r.cbms_response_code,
            "attempt_count": r.attempt_count,
            "last_attempted_at": r.last_attempted_at,
            "synced_at": r.synced_at,
        }
        for r in items
    ]
    return success_response(
        data=data, meta=build_meta(total, paging["page"], paging["per_page"])
    )


@router.post("/sync-log/{log_id}/resync", dependencies=owner_dep)
def resync_one(
    log_id: str,
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    from jobs.cbms_jobs import sync_document_job

    user = current_user["user"]
    row = CbmsSyncLogRepository.get_by_id(db, user.tenant_id, log_id)
    if not row:
        return error_response("NOT_FOUND", "Sync log entry not found", 404)
    try:
        sync_document_job(row.source_app, row.document_type, row.document_id, user.tenant_id)
    except RuntimeError:
        return error_response("CBMS_SYNC_TRANSIENT", "CBMS sync failed, safe to retry", 400)
    db.refresh(row)
    return success_response(data={"status": row.status})


@router.post("/sync-log/resync-failed", dependencies=owner_dep)
def resync_all_failed(
    app: str | None = None,
    current_user: dict = Depends(require_role(["owner", "manager"])),
    db: Session = Depends(get_db),
):
    """Bulk resync — re-enqueues every currently-failed row (via RQ, not
    inline, since this could be many documents) for this tenant, optionally
    scoped to one app. Re-runs the same classification logic sync_document_job
    always does, so a row whose failure was actually "manual" (bad payload,
    stale credentials) will just fail the same way again and stay failed —
    this button doesn't distinguish retry-worthy vs not up front, it relies
    on the job itself being a no-op for genuinely unfixable rows."""
    from rq import Retry
    from core.queue import job_queue
    from jobs.cbms_jobs import sync_document_job

    user = current_user["user"]
    items, _ = CbmsSyncLogRepository.list_for_tenant(db, user.tenant_id, app, "failed", 0, 1000)
    enqueued = 0
    for row in items:
        job_queue.enqueue(
            sync_document_job,
            row.source_app,
            row.document_type,
            row.document_id,
            user.tenant_id,
            retry=Retry(max=3, interval=[60, 300, 900]),
        )
        enqueued += 1
    return success_response(data={"enqueued": enqueued})
