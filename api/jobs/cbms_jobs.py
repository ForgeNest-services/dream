"""RQ jobs for CBMS bill/credit-note submission — replaces the old
in-process FastAPI BackgroundTasks (features/ims/cbms_service.py's and
features/restro/cbms_service.py's now-removed sync_*_background functions).

Enqueue via api/core/queue.py's job_queue, e.g.:
    from rq import Retry
    job_queue.enqueue(
        sync_document_job, "ims", "invoice", invoice.id, tenant_id,
        retry=Retry(max=3, interval=[60, 300, 900]),
    )

Retry semantics (see features/cbms/submit.py's classify_response, which
mirrors docs/Srota_IRD_Compliance_Checklist.md's exact per-code table):
  - "synced"     -> log synced, return normally (RQ: done, no retry)
  - "retry"      -> log failed, RAISE (RQ: retries per the Retry() policy
                    passed at enqueue time — this is the only path that
                    should actually retry)
  - "manual"/    -> log failed, return normally WITHOUT raising (RQ: job
    "auth_stale"   reports success and stops — a human needs to look at
                   this, blind retrying won't help)
"""
from core.database import SessionLocal
from features.cbms.credential_service import CBMSCredentialRepository
from features.cbms.sync_log import CbmsSyncLogRepository
from features.cbms.submit import (
    IRD_CBMS_URL,
    IRD_CBMS_RETURN_URL,
    post_to_cbms,
    CLASSIFICATION_SYNCED,
    CLASSIFICATION_RETRY,
)
from utils.logger import logger


def _load_document(db, source_app: str, document_type: str, document_id: str, tenant_id: str):
    """Returns (document, original_document_or_None) for the given source
    app/document type. original is only populated for credit notes."""
    if source_app == "ims":
        from features.ims.invoice_repository import IMSInvoiceRepository

        doc = IMSInvoiceRepository.get_by_id(db, tenant_id, document_id)
        original = None
        if doc and document_type == "credit_note" and doc.original_invoice_id:
            original = IMSInvoiceRepository.get_by_id(db, tenant_id, doc.original_invoice_id)
        return doc, original
    if source_app == "restro":
        from features.restro.order_repository import OrderRepository

        doc = OrderRepository.get_by_id(db, tenant_id, document_id)
        original = None
        if doc and document_type == "credit_note" and doc.original_order_id:
            original = OrderRepository.get_by_id(db, tenant_id, doc.original_order_id)
        return doc, original
    raise ValueError(f"Unknown source_app: {source_app}")


def _build_payload(source_app: str, document_type: str, doc, original, org):
    if source_app == "ims":
        from features.ims.cbms_service import build_cbms_payload, build_credit_note_payload

        if document_type == "credit_note":
            return build_credit_note_payload(doc, original, org)
        return build_cbms_payload(doc, org)
    if source_app == "restro":
        from features.restro.cbms_service import build_cbms_payload, build_credit_note_payload

        if document_type == "credit_note":
            return build_credit_note_payload(doc, original, org)
        return build_cbms_payload(doc, org)
    raise ValueError(f"Unknown source_app: {source_app}")


def _document_number(source_app: str, doc) -> str | None:
    if source_app == "ims":
        return doc.number
    if source_app == "restro":
        return str(doc.bill_number)
    return None


def _mark_document_synced(db, source_app: str, document_id: str) -> None:
    """Stamps the source document's own cbms_synced/cbms_synced_at columns
    (kept for quick "synced?" checks in each app's own UI/list views) — the
    CbmsSyncLog row is the authoritative history, this is a denormalized
    convenience flag on the document itself."""
    from sqlalchemy import text

    table = "ims_invoices" if source_app == "ims" else "restro_orders"
    db.execute(
        text(f"UPDATE public.{table} SET cbms_synced = TRUE, cbms_synced_at = NOW() WHERE id = :id"),
        {"id": document_id},
    )
    db.commit()


def sync_document_job(
    source_app: str,
    document_type: str,
    document_id: str,
    tenant_id: str,
) -> None:
    """The RQ job body. Idempotent-safe to re-invoke (e.g. RQ retry, or a
    manual resync click) — re-checks the sync log and the org's current
    settings fresh on every call rather than trusting anything the enqueuer
    knew at enqueue time (credentials or the sync-enabled toggle may have
    changed between enqueue and execution)."""
    db = SessionLocal()
    try:
        log_row = CbmsSyncLogRepository.get_or_create_pending(
            db, tenant_id, source_app, document_type, document_id, None
        )
        if log_row.status == "synced":
            # Already done (e.g. a stale retry firing after a manual resync
            # already succeeded) — the DB's partial unique index would
            # reject a second synced row anyway, but checking here avoids
            # even attempting the network call.
            return

        doc, original = _load_document(db, source_app, document_type, document_id, tenant_id)
        if not doc:
            CbmsSyncLogRepository.record_attempt(db, log_row, "failed", None, "Document not found")
            logger.error(f"CBMS sync: {source_app} {document_type} {document_id} not found")
            return
        log_row.document_number = _document_number(source_app, doc)

        from features.tax_settings.service import TaxSettingsService

        if not TaxSettingsService.is_app_certified(source_app):
            # Real enforcement point for the checklist's "gate the toggle
            # until certified" requirement — the shared cbms_sync_enabled
            # toggle can't know per-app certification state on its own
            # (see TaxSettingsService.set_sync_enabled's docstring), so
            # every single sync attempt re-checks here instead.
            CbmsSyncLogRepository.record_attempt(
                db, log_row, "failed", None, f"{source_app} is not yet IRD-certified"
            )
            logger.warning(f"CBMS sync blocked: {source_app} not certified ({document_id})")
            return

        org = CBMSCredentialRepository.get(db, tenant_id)
        if not org:
            # Sync-enabled toggle was turned off (or credentials removed)
            # between enqueue and now — not a failure, just nothing to do.
            CbmsSyncLogRepository.record_attempt(
                db, log_row, "failed", None, "CBMS sync not enabled or credentials missing"
            )
            return

        payload = _build_payload(source_app, document_type, doc, original, org)
        url = IRD_CBMS_RETURN_URL if document_type == "credit_note" else IRD_CBMS_URL
        result = post_to_cbms(url, payload, is_credit_note=(document_type == "credit_note"))

        classification = result["classification"]
        response_body_str = str(result["raw_body"])[:4000]  # cap — this is a TEXT column, not unbounded

        if classification == CLASSIFICATION_SYNCED:
            CbmsSyncLogRepository.record_attempt(db, log_row, "synced", result["code"], response_body_str)
            _mark_document_synced(db, source_app, document_id)
            logger.info(f"CBMS synced: {source_app} {document_type} {document_id}")
            return

        CbmsSyncLogRepository.record_attempt(db, log_row, "failed", result["code"], response_body_str)
        logger.warning(
            f"CBMS sync not completed: {source_app} {document_type} {document_id} "
            f"code={result['code']} classification={classification}"
        )
        if classification == CLASSIFICATION_RETRY:
            # Raise so RQ's Retry() policy (set at enqueue time) requeues
            # this with backoff — the only classification worth retrying.
            raise RuntimeError(f"CBMS transient failure (code {result['code']}), will retry")
        # "manual" / "auth_stale" — job completes "successfully" from RQ's
        # perspective (no raise) so it does NOT get auto-retried; a human
        # needs to fix the root cause (bad payload, stale credentials, a
        # credit note referencing an invoice IRD never accepted) and
        # trigger a resync explicitly via the sync-status UI.
    finally:
        db.close()
