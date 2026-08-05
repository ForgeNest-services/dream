from sqlalchemy.orm import Session
from shared_models import PMSGuest


def _normalize(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return v if v else None


class GuestRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        full_name: str,
        phone: str | None,
        email: str | None,
        id_document_type: str | None,
        id_document_number: str | None,
        nationality: str | None,
    ) -> PMSGuest:
        guest = PMSGuest(
            tenant_id=tenant_id,
            full_name=full_name.strip(),
            phone=_normalize(phone),
            email=_normalize(email.lower() if email else None),
            id_document_type=_normalize(id_document_type),
            id_document_number=_normalize(id_document_number),
            nationality=_normalize(nationality),
        )
        db.add(guest)
        db.commit()
        db.refresh(guest)
        return guest

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, guest_id: str) -> PMSGuest | None:
        return (
            db.query(PMSGuest)
            .filter(PMSGuest.id == guest_id, PMSGuest.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[PMSGuest]:
        return (
            db.query(PMSGuest)
            .filter(PMSGuest.tenant_id == tenant_id, PMSGuest.is_active == True)
            .order_by(PMSGuest.full_name)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        guest: PMSGuest,
        full_name: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        id_document_type: str | None = None,
        id_document_number: str | None = None,
        nationality: str | None = None,
        is_active: bool | None = None,
    ) -> PMSGuest:
        if full_name is not None:
            guest.full_name = full_name.strip()
        if phone is not None:
            guest.phone = _normalize(phone)
        if email is not None:
            guest.email = _normalize(email.lower())
        if id_document_type is not None:
            guest.id_document_type = _normalize(id_document_type)
        if id_document_number is not None:
            guest.id_document_number = _normalize(id_document_number)
        if nationality is not None:
            guest.nationality = _normalize(nationality)
        if is_active is not None:
            guest.is_active = is_active
        db.commit()
        db.refresh(guest)
        return guest
