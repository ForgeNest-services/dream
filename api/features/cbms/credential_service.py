from sqlalchemy.orm import Session
from shared_models.org_tax_settings import OrgTaxSettings

# Tax settings (PAN + IRD credentials + sync-enabled toggle) are tenant-
# level, not app-specific — one IRD Taxpayer Portal login per business,
# shared by every app that submits bills to CBMS (IMS, RMS, ...). Entered
# and edited exactly once, from admin/ (see features/tax_settings/) — this
# module is the READ side other apps' sync jobs use to fetch the org's
# current settings. Writing lives in features/tax_settings/service.py,
# which enforces consent + the per-app certification gate that this module
# deliberately doesn't know about.


class CBMSCredentialRepository:
    @staticmethod
    def get(db: Session, tenant_id: str) -> OrgTaxSettings | None:
        return db.query(OrgTaxSettings).filter(
            OrgTaxSettings.tenant_id == tenant_id,
            OrgTaxSettings.cbms_sync_enabled == True,
            OrgTaxSettings.ird_username.isnot(None),
            OrgTaxSettings.ird_password.isnot(None),
        ).first()
