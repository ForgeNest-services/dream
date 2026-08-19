from sqlalchemy.orm import Session
from shared_models import IMSCredential


class IMSCredentialRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        role: str,
        username: str,
        password_hash: str,
        created_by: str,
        branch_id: str | None = None,
    ) -> IMSCredential:
        cred = IMSCredential(
            tenant_id=tenant_id,
            branch_id=branch_id,
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
    def get_by_id(db: Session, tenant_id: str, cred_id: str) -> IMSCredential | None:
        return (
            db.query(IMSCredential)
            .filter(
                IMSCredential.id == cred_id,
                IMSCredential.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def get_by_tenant_branch_and_role(
        db: Session, tenant_id: str, branch_id: str | None, role: str
    ) -> IMSCredential | None:
        return (
            db.query(IMSCredential)
            .filter(
                IMSCredential.tenant_id == tenant_id,
                IMSCredential.branch_id == branch_id,
                IMSCredential.role == role,
            )
            .first()
        )

    @staticmethod
    def get_by_username(db: Session, username: str) -> IMSCredential | None:
        return (
            db.query(IMSCredential)
            .filter(IMSCredential.username == username)
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[IMSCredential]:
        return (
            db.query(IMSCredential)
            .filter(IMSCredential.tenant_id == tenant_id)
            .order_by(IMSCredential.role)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        cred: IMSCredential,
        username: str | None = None,
        password_hash: str | None = None,
    ) -> IMSCredential:
        if username is not None:
            cred.username = username
        if password_hash is not None:
            cred.password_hash = password_hash
        db.commit()
        db.refresh(cred)
        return cred

    @staticmethod
    def delete(db: Session, cred: IMSCredential) -> None:
        db.delete(cred)
        db.commit()
