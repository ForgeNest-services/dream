from decimal import Decimal
from sqlalchemy.orm import Session

from core import storage
from features.ims.branch_settings_repository import IMSBranchSettingsRepository
from features.branches.repository import BranchRepository
from features.auth.repository import TenantRepository
from utils.logger import logger


class IMSBranchSettingsService:
    @staticmethod
    def get_or_create(db: Session, tenant_id: str, branch_id: str) -> dict:
        """Load the branch's settings row, auto-provisioning defaults if it
        doesn't exist yet — same pattern as categories/zones elsewhere."""
        if not BranchRepository.get_by_id(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        tenant = TenantRepository.get_by_id(db, tenant_id)
        tenant_is_vat_registered = bool(tenant and tenant.is_vat_registered)

        settings = IMSBranchSettingsRepository.get(db, tenant_id, branch_id)
        if not settings:
            # VAT can only ever start on for a tenant that's actually
            # VAT-registered — the same rule update() already enforces for
            # an explicit change. A tenant that registers for VAT later gets
            # a settings row here first (PAN-only), then flips vat_enabled
            # on themselves via Settings once they are.
            settings = IMSBranchSettingsRepository.create_default(
                db, tenant_id, branch_id, vat_enabled=tenant_is_vat_registered
            )
            logger.info(
                f"Auto-provisioned default IMS branch settings for {branch_id}",
                extra={
                    "tenant_id": tenant_id,
                    "branch_id": branch_id,
                    "vat_enabled": tenant_is_vat_registered,
                },
            )
            return {"success": True, "settings": settings}

        # Keep vat_enabled in sync with the tenant's actual registration
        # status in both directions. VAT→PAN: auto-disable so a stale
        # enabled flag doesn't outlive the registration that justified it.
        # PAN→VAT: auto-re-enable, so a tenant who re-registers for VAT
        # (after a prior VAT→PAN switch forced this off) gets the taxable
        # pricing fields back without having to manually flip the Settings
        # toggle — vat_enabled has no independent "business chose to stay
        # exempt while registered" meaning, it's purely derived state here.
        if settings.vat_enabled and not tenant_is_vat_registered:
            settings = IMSBranchSettingsRepository.update(db, settings, vat_enabled=False)
            logger.info(
                f"Auto-disabled VAT for branch {branch_id} — tenant is no longer VAT-registered",
                extra={"tenant_id": tenant_id},
            )
        elif not settings.vat_enabled and tenant_is_vat_registered:
            settings = IMSBranchSettingsRepository.update(db, settings, vat_enabled=True)
            logger.info(
                f"Auto-enabled VAT for branch {branch_id} — tenant is VAT-registered again",
                extra={"tenant_id": tenant_id},
            )
        return {"success": True, "settings": settings}

    @staticmethod
    def _delete_old_qr(old_url: str | None) -> None:
        """Best-effort MinIO cleanup for a replaced/cleared QR. Never raises —
        an orphaned object is a minor tidiness issue, not a functional one."""
        if not old_url:
            return
        key = storage.key_from_url(old_url)
        if not key:
            return
        try:
            storage.delete_file(key)
        except Exception as e:
            logger.warning(f"Failed to delete old QR image from storage: {key} — {e}")

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        vat_enabled: bool | None,
        vat_rate: Decimal | None,
        qr_image_url: str | None = None,
        clear_qr: bool = False,
    ) -> dict:
        result = IMSBranchSettingsService.get_or_create(db, tenant_id, branch_id)
        if not result["success"]:
            return result
        settings = result["settings"]

        if vat_rate is not None and (vat_rate < 0 or vat_rate > 100):
            return {"success": False, "error_code": "INVALID_VAT_RATE"}

        # Server-side enforcement, not just a disabled frontend toggle: VAT
        # can never be turned on for a tenant that isn't actually
        # VAT-registered, regardless of what the request asks for.
        if vat_enabled:
            tenant = TenantRepository.get_by_id(db, tenant_id)
            if not tenant or not tenant.is_vat_registered:
                return {"success": False, "error_code": "NOT_VAT_REGISTERED"}

        old_qr_url = settings.qr_image_url
        qr_changed = clear_qr or (qr_image_url is not None and qr_image_url != old_qr_url)

        updated = IMSBranchSettingsRepository.update(
            db,
            settings,
            vat_enabled=vat_enabled,
            vat_rate=vat_rate,
            qr_image_url=qr_image_url,
            clear_qr=clear_qr,
        )
        if qr_changed:
            IMSBranchSettingsService._delete_old_qr(old_qr_url)
        logger.info(f"IMS branch settings updated: {branch_id}", extra={"tenant_id": tenant_id})
        return {"success": True, "settings": updated}

    @staticmethod
    def clear_qr(db: Session, tenant_id: str, branch_id: str) -> dict:
        """Dedicated endpoint for the "remove QR" button — same as update
        with clear_qr=True but exposed as its own DELETE route for clarity."""
        return IMSBranchSettingsService.update(
            db, tenant_id, branch_id, vat_enabled=None, vat_rate=None, clear_qr=True
        )
