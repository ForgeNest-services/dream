from sqlalchemy.orm import Session
from shared_models import Tenant, User, PlatformAdmin


class TenantRepository:
    @staticmethod
    def create(db: Session, name: str) -> Tenant:
        tenant = Tenant(name=name)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        return tenant

    @staticmethod
    def get_by_id(db: Session, tenant_id: str) -> Tenant:
        return db.query(Tenant).filter(Tenant.id == tenant_id).first()


class UserRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        full_name: str,
        email: str,
        password_hash: str,
        is_owner: bool = False,
        picture_url: str = None,
        role: str = "staff",
    ) -> User:
        user = User(
            tenant_id=tenant_id,
            full_name=full_name,
            email=email,
            password_hash=password_hash,
            is_owner=is_owner,
            picture_url=picture_url,
            role=role,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_by_email(db: Session, email: str) -> User:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_by_id(db: Session, user_id: str) -> User:
        return db.query(User).filter(User.id == user_id).first()


class PlatformAdminRepository:
    @staticmethod
    def get_by_email(db: Session, email: str) -> PlatformAdmin:
        return db.query(PlatformAdmin).filter(PlatformAdmin.email == email).first()

    @staticmethod
    def get_by_id(db: Session, admin_id: str) -> PlatformAdmin:
        return db.query(PlatformAdmin).filter(PlatformAdmin.id == admin_id).first()
