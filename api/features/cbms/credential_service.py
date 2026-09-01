import uuid
from sqlalchemy.orm import Session
from core.crypto import encrypt_secret
from shared_models.ims_cbms_credential import IMSCbmsCredential
from utils.logger import logger

# Table name kept as ims_cbms_credentials for historical reasons (it was
# built for IMS first) — but the credential itself is tenant-level, not
# app-specific: one IRD Taxpayer Portal login per business, shared by every
# app that submits bills to CBMS (IMS, RMS, ...). Never rename/duplicate
# this per app — a tenant running both apps must only enter their IRD
# password once.


class CBMSCredentialRepository:
    @staticmethod
    def get(db: Session, tenant_id: str) -> IMSCbmsCredential | None:
        return db.query(IMSCbmsCredential).filter(
            IMSCbmsCredential.tenant_id == tenant_id,
            IMSCbmsCredential.is_active == True,
        ).first()

    @staticmethod
    def upsert(db: Session, tenant_id: str, ird_username: str, ird_password: str) -> IMSCbmsCredential:
        """ird_password is the tenant's real IRD Taxpayer Portal password —
        always stored encrypted (core/crypto.py), never in plaintext."""
        encrypted_password = encrypt_secret(ird_password)
        cred = db.query(IMSCbmsCredential).filter(
            IMSCbmsCredential.tenant_id == tenant_id
        ).first()
        if cred:
            cred.ird_username = ird_username
            cred.ird_password = encrypted_password
            cred.is_active = True
        else:
            cred = IMSCbmsCredential(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                ird_username=ird_username,
                ird_password=encrypted_password,
            )
            db.add(cred)
        db.flush()
        return cred


class CBMSCredentialService:
    @staticmethod
    def get_credentials(db: Session, tenant_id: str) -> dict:
        cred = CBMSCredentialRepository.get(db, tenant_id)
        if not cred:
            return {"success": False, "error_code": "CBMS_NOT_CONFIGURED"}
        return {
            "success": True,
            "credentials": {
                "ird_username": cred.ird_username,
                "ird_password": "••••••••",
                "is_active": cred.is_active,
            },
        }

    @staticmethod
    def save_credentials(db: Session, tenant_id: str, ird_username: str, ird_password: str) -> dict:
        try:
            CBMSCredentialRepository.upsert(db, tenant_id, ird_username, ird_password)
            db.commit()
            return {"success": True}
        except Exception as e:
            db.rollback()
            logger.error(f"CBMS credential save failed: {e}")
            return {"success": False, "error_code": "CBMS_SAVE_FAILED"}
