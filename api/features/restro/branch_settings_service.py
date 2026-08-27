from decimal import Decimal
from sqlalchemy.orm import Session

from core import storage
from features.restro.branch_settings_repository import BranchSettingsRepository
from features.branches.repository import BranchRepository
from features.auth.repository import TenantRepository
from utils.logger import logger


class BranchSettingsService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def get_or_create(db: Session, tenant_id: str, branch_id: str) -> dict:
        """Load the branch's settings row, auto-provisioning defaults if it
        doesn't exist yet. Matches how categories / zones auto-provision on
        first read — the frontend never has to know whether a row exists."""
        if not BranchSettingsService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        settings = BranchSettingsRepository.get(db, tenant_id, branch_id)
        if not settings:
            # VAT can only ever start on for a tenant that's actually
            # VAT-registered. A tenant that registers for VAT later gets a
            # settings row here first (PAN-only), then flips vat_enabled on
            # themselves via Settings once they are.
            tenant = TenantRepository.get_by_id(db, tenant_id)
            vat_enabled = bool(tenant and tenant.is_vat_registered)
            settings = BranchSettingsRepository.create_default(
                db, tenant_id, branch_id, vat_enabled=vat_enabled
            )
            logger.info(
                f"Auto-provisioned default settings for branch {branch_id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "vat_enabled": vat_enabled},
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
        vat_enabled: bool | None = None,
        vat_rate: Decimal | None = None,
        qr_image_url: str | None = None,
        clear_qr: bool = False,
    ) -> dict:
        result = BranchSettingsService.get_or_create(db, tenant_id, branch_id)
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

        # Capture the pre-update QR URL so we can delete it from MinIO after
        # a successful DB update. We defer the storage call — DB integrity
        # is what matters, orphan cleanup is best-effort.
        old_qr_url = settings.qr_image_url
        qr_changed = clear_qr or (qr_image_url is not None and qr_image_url != old_qr_url)

        updated = BranchSettingsRepository.update(
            db,
            settings,
            vat_enabled=vat_enabled,
            vat_rate=vat_rate,
            qr_image_url=qr_image_url,
            clear_qr=clear_qr,
        )
        if qr_changed:
            BranchSettingsService._delete_old_qr(old_qr_url)
        return {"success": True, "settings": updated}

    @staticmethod
    def clear_qr(db: Session, tenant_id: str, branch_id: str) -> dict:
        """Dedicated endpoint for the "remove QR" button — same as update
        with clear_qr=True but exposed as its own DELETE route for clarity."""
        return BranchSettingsService.update(
            db, tenant_id, branch_id, clear_qr=True
        )
