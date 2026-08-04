from sqlalchemy.orm import Session
from shared_models import HotelPMSCredential


class HotelPMSCredentialRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        role: str,
        username: str,
        password_hash: str,
        created_by: str,
    ) -> HotelPMSCredential:
        cred = HotelPMSCredential(
            tenant_id=tenant_id,
            role=role,
            username=username,
            password_hash=password_hash,
            created_by=created_by,
        )
        db.add(cred)
        db.commit()
        db.refresh(cred)
        return cred

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, cred_id: str) -> HotelPMSCredential | None:
        return (
            db.query(HotelPMSCredential)
            .filter(
                HotelPMSCredential.id == cred_id,
                HotelPMSCredential.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def get_by_tenant_and_role(
        db: Session, tenant_id: str, role: str
    ) -> HotelPMSCredential | None:
        return (
            db.query(HotelPMSCredential)
            .filter(
                HotelPMSCredential.tenant_id == tenant_id,
                HotelPMSCredential.role == role,
            )
            .first()
        )

    @staticmethod
    def get_by_username(db: Session, username: str) -> HotelPMSCredential | None:
        return (
            db.query(HotelPMSCredential)
            .filter(HotelPMSCredential.username == username)
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[HotelPMSCredential]:
        return (
            db.query(HotelPMSCredential)
            .filter(HotelPMSCredential.tenant_id == tenant_id)
            .order_by(HotelPMSCredential.role)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        cred: HotelPMSCredential,
        username: str | None = None,
        password_hash: str | None = None,
    ) -> HotelPMSCredential:
        if username is not None:
            cred.username = username
        if password_hash is not None:
            cred.password_hash = password_hash
        db.commit()
        db.refresh(cred)
        return cred

    @staticmethod
    def delete(db: Session, cred: HotelPMSCredential) -> None:
        db.delete(cred)
        db.commit()
