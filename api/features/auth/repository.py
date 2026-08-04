from sqlalchemy.orm import Session
from shared_models import Tenant, User, PlatformAdmin


def _normalize(value: str | None, mode: str = "strip") -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if mode == "upper":
        return cleaned.upper()
    if mode == "lower":
        return cleaned.lower()
    return cleaned


class TenantRepository:
    @staticmethod
    def create(
        db: Session,
        name: str,
        pan: str = None,
        business_address: str = None,
        business_phone: str = None,
        business_email: str = None,
    ) -> Tenant:
        tenant = Tenant(
            name=name.strip(),
            pan=_normalize(pan, "upper"),
            business_address=_normalize(business_address),
            business_phone=_normalize(business_phone),
            business_email=_normalize(business_email, "lower"),
        )
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
        role: str = "owner",
        owner_id: str = None,
    ) -> User:
        user = User(
            tenant_id=tenant_id,
            full_name=full_name,
            email=email,
            password_hash=password_hash,
            is_owner=is_owner,
            picture_url=picture_url,
            role=role,
            owner_id=owner_id,
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
