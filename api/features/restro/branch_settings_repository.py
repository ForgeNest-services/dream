from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from shared_models import RestroBranchSettings


class BranchSettingsRepository:
    @staticmethod
    def get(db: Session, tenant_id: str, branch_id: str) -> RestroBranchSettings | None:
        return (
            db.query(RestroBranchSettings)
            .filter(
                RestroBranchSettings.tenant_id == tenant_id,
                RestroBranchSettings.branch_id == branch_id,
            )
            .first()
        )

    @staticmethod
    def create_default(
        db: Session, tenant_id: str, branch_id: str, vat_enabled: bool
    ) -> RestroBranchSettings:
        now = datetime.now(timezone.utc)
        row = RestroBranchSettings(
            tenant_id=tenant_id,
            branch_id=branch_id,
            vat_enabled=vat_enabled,
            vat_rate=Decimal("13"),
            qr_image_url=None,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def update(
        db: Session,
        settings: RestroBranchSettings,
        vat_enabled: bool | None = None,
        vat_rate: Decimal | None = None,
        qr_image_url: str | None = None,
        clear_qr: bool = False,
        cbms_realtime_enabled: bool | None = None,
        default_hs_code: str | None = None,
        clear_hs_code: bool = False,
    ) -> RestroBranchSettings:
        if vat_enabled is not None:
            settings.vat_enabled = vat_enabled
        if vat_rate is not None:
            settings.vat_rate = vat_rate
        if cbms_realtime_enabled is not None:
            settings.cbms_realtime_enabled = cbms_realtime_enabled
        if clear_hs_code:
            settings.default_hs_code = None
        elif default_hs_code is not None:
            settings.default_hs_code = default_hs_code.strip() or None
        # clear_qr wins over qr_image_url so a caller can null it in the
        # same PATCH that also touches vat fields.
        if clear_qr:
            settings.qr_image_url = None
        elif qr_image_url is not None:
            settings.qr_image_url = qr_image_url
        db.commit()
        db.refresh(settings)
        return settings
