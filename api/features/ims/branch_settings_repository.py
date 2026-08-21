from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from shared_models import IMSBranchSettings


class IMSBranchSettingsRepository:
    @staticmethod
    def get(db: Session, tenant_id: str, branch_id: str) -> IMSBranchSettings | None:
        return (
            db.query(IMSBranchSettings)
            .filter(
                IMSBranchSettings.tenant_id == tenant_id,
                IMSBranchSettings.branch_id == branch_id,
            )
            .first()
        )

    @staticmethod
    def create_default(db: Session, tenant_id: str, branch_id: str) -> IMSBranchSettings:
        now = datetime.now(timezone.utc)
        row = IMSBranchSettings(
            tenant_id=tenant_id,
            branch_id=branch_id,
            vat_enabled=True,
            vat_rate=Decimal("13"),
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
        settings: IMSBranchSettings,
        vat_enabled: bool | None = None,
        vat_rate: Decimal | None = None,
    ) -> IMSBranchSettings:
        if vat_enabled is not None:
            settings.vat_enabled = vat_enabled
        if vat_rate is not None:
            settings.vat_rate = vat_rate
        db.commit()
        db.refresh(settings)
        return settings
