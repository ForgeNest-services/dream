from sqlalchemy.orm import Session
from core.configs import settings
from core.crypto import encrypt_secret
from features.auth.repository import TenantRepository
from features.tax_settings.repository import TaxSettingsRepository
from features.cbms.sync_log import CbmsSyncLogRepository
from utils.logger import logger

# Certification gate: RQ auto-sync must never be enableable for an app
# that isn't actually IRD-certified yet (docs/Srota_IRD_Compliance_Checklist.md's
# "Testing phase" section for both apps). One bool per app, flipped in
# core/configs.py once certification is granted — no code change needed
# beyond that env var.
_CERTIFIED_APPS = {
    "ims": lambda: settings.IMS_CBMS_CERTIFIED,
    "restro": lambda: settings.RMS_CBMS_CERTIFIED,
}


class TaxSettingsService:
    @staticmethod
    def get(db: Session, tenant_id: str) -> dict:
        row = TaxSettingsRepository.get_or_create(db, tenant_id)
        sync_summary = CbmsSyncLogRepository.summary_for_tenant(db, tenant_id)
        return {
            "success": True,
            "settings": {
                "pan": row.pan,
                "ird_username": row.ird_username,
                "ird_password_set": bool(row.ird_password),
                "cbms_sync_enabled": row.cbms_sync_enabled,
                "consent_acknowledged_at": row.consent_acknowledged_at,
                "credentials_updated_at": row.credentials_updated_at,
            },
            "sync_summary": sync_summary,
        }

    @staticmethod
    def save_credentials(db: Session, tenant_id: str, ird_username: str, ird_password: str) -> dict:
        """PAN is never re-entered here — always pulled fresh from
        tenants.pan (the business's actual registered PAN, edited from the
        existing Business Settings card), so this record can't drift from
        the source of truth."""
        tenant = TenantRepository.get_by_id(db, tenant_id)
        if not tenant:
            return {"success": False, "error_code": "TENANT_NOT_FOUND"}
        # CBMS real-time sync only ever applies to a VAT bill (dफा ६.४क) —
        # a PAN-only business has nothing to submit, so don't let it hold
        # live IRD portal credentials in the system at all. Matches the
        # same gate already enforced on vat_enabled/cbms_realtime_enabled
        # in branch_settings_service.py.
        if not tenant.is_vat_registered:
            return {"success": False, "error_code": "NOT_VAT_REGISTERED"}
        row = TaxSettingsRepository.get_or_create(db, tenant_id)
        encrypted = encrypt_secret(ird_password)
        row = TaxSettingsRepository.save_credentials(db, row, tenant.pan, ird_username, encrypted)
        logger.info(f"Tax settings credentials saved for tenant {tenant_id}")
        return {"success": True, "settings": row}

    @staticmethod
    def set_sync_enabled(db: Session, tenant_id: str, enabled: bool) -> dict:
        """One shared toggle (the Owner's on/off switch in admin/) — but
        certification is granted PER APP, independently, and this flag
        can't know in advance which apps a tenant will use. So this only
        checks credentials exist; the actual per-app certification gate
        lives in jobs/cbms_jobs.py's sync_document_job, which re-checks
        is_app_certified(source_app) on every single sync attempt — that's
        the real enforcement point, not this toggle. Turning this on when
        only one app is certified is safe: the other app's syncs will just
        keep landing in the sync log as "failed / not certified" until its
        own certification lands, nothing gets submitted to IRD for it."""
        row = TaxSettingsRepository.get(db, tenant_id)
        if not row or not row.ird_username or not row.ird_password:
            return {"success": False, "error_code": "CREDENTIALS_NOT_SAVED"}
        if enabled:
            tenant = TenantRepository.get_by_id(db, tenant_id)
            if not tenant or not tenant.is_vat_registered:
                return {"success": False, "error_code": "NOT_VAT_REGISTERED"}
        row = TaxSettingsRepository.set_sync_enabled(db, row, enabled)
        return {"success": True, "settings": row}

    @staticmethod
    def is_app_certified(app: str) -> bool:
        check = _CERTIFIED_APPS.get(app)
        return bool(check and check())
