from decimal import Decimal
from sqlalchemy.orm import Session

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
        settings = IMSBranchSettingsRepository.get(db, tenant_id, branch_id)
        if not settings:
            settings = IMSBranchSettingsRepository.create_default(db, tenant_id, branch_id)
            logger.info(
                f"Auto-provisioned default IMS branch settings for {branch_id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id},
            )
        return {"success": True, "settings": settings}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        vat_enabled: bool | None,
        vat_rate: Decimal | None,
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

        updated = IMSBranchSettingsRepository.update(
            db, settings, vat_enabled=vat_enabled, vat_rate=vat_rate
        )
        logger.info(f"IMS branch settings updated: {branch_id}", extra={"tenant_id": tenant_id})
        return {"success": True, "settings": updated}
