import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from shared_models.org_tax_settings import OrgTaxSettings


class TaxSettingsRepository:
    @staticmethod
    def get(db: Session, tenant_id: str) -> OrgTaxSettings | None:
        return db.query(OrgTaxSettings).filter(OrgTaxSettings.tenant_id == tenant_id).first()

    @staticmethod
    def get_or_create(db: Session, tenant_id: str) -> OrgTaxSettings:
        row = TaxSettingsRepository.get(db, tenant_id)
        if row:
            return row
        row = OrgTaxSettings(id=str(uuid.uuid4()), tenant_id=tenant_id)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def save_credentials(
        db: Session,
        row: OrgTaxSettings,
        pan: str | None,
        ird_username: str,
        encrypted_password: str,
    ) -> OrgTaxSettings:
        now = datetime.now(timezone.utc)
        row.pan = pan
        row.ird_username = ird_username
        row.ird_password = encrypted_password
        row.consent_acknowledged_at = now
        row.credentials_updated_at = now
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def set_sync_enabled(db: Session, row: OrgTaxSettings, enabled: bool) -> OrgTaxSettings:
        row.cbms_sync_enabled = enabled
        db.commit()
        db.refresh(row)
        return row
