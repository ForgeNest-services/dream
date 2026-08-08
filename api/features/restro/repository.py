from sqlalchemy.orm import Session
from shared_models import RestroCredential


class RestroCredentialRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        role: str,
        username: str,
        password_hash: str,
        created_by: str,
        branch_id: str | None = None,
    ) -> RestroCredential:
        cred = RestroCredential(
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
    def get_by_id(db: Session, tenant_id: str, cred_id: str) -> RestroCredential | None:
        return (
            db.query(RestroCredential)
            .filter(
                RestroCredential.id == cred_id,
                RestroCredential.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def get_by_tenant_branch_and_role(
        db: Session, tenant_id: str, branch_id: str | None, role: str
    ) -> RestroCredential | None:
        return (
            db.query(RestroCredential)
            .filter(
                RestroCredential.tenant_id == tenant_id,
                RestroCredential.branch_id == branch_id,
                RestroCredential.role == role,
            )
            .first()
        )

    @staticmethod
    def get_by_username(db: Session, username: str) -> RestroCredential | None:
        return (
            db.query(RestroCredential)
            .filter(RestroCredential.username == username)
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[RestroCredential]:
        return (
            db.query(RestroCredential)
            .filter(RestroCredential.tenant_id == tenant_id)
            .order_by(RestroCredential.role)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        cred: RestroCredential,
        username: str | None = None,
        password_hash: str | None = None,
    ) -> RestroCredential:
        if username is not None:
            cred.username = username
        if password_hash is not None:
            cred.password_hash = password_hash
        db.commit()
        db.refresh(cred)
        return cred

    @staticmethod
    def delete(db: Session, cred: RestroCredential) -> None:
        db.delete(cred)
        db.commit()
