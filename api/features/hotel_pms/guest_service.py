from sqlalchemy.orm import Session
from features.hotel_pms.guest_repository import GuestRepository
from utils.logger import logger


class GuestService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list:
        return GuestRepository.list_for_tenant(db, tenant_id)

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        full_name: str,
        phone: str | None = None,
        email: str | None = None,
        id_document_type: str | None = None,
        id_document_number: str | None = None,
        nationality: str | None = None,
    ) -> dict:
        try:
            guest = GuestRepository.create(
                db,
                tenant_id=tenant_id,
                full_name=full_name,
                phone=phone,
                email=email,
                id_document_type=id_document_type,
                id_document_number=id_document_number,
                nationality=nationality,
            )
            logger.info(
                f"Guest created: {guest.id}",
                extra={"tenant_id": tenant_id, "name": full_name},
            )
            return {"success": True, "guest": guest}
        except Exception as e:
            db.rollback()
            logger.error(f"Guest creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        guest_id: str,
        full_name: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        id_document_type: str | None = None,
        id_document_number: str | None = None,
        nationality: str | None = None,
    ) -> dict:
        guest = GuestRepository.get_by_id(db, tenant_id, guest_id)
        if not guest:
            return {"success": False, "error_code": "GUEST_NOT_FOUND"}

        try:
            updated = GuestRepository.update(
                db,
                guest,
                full_name=full_name,
                phone=phone,
                email=email,
                id_document_type=id_document_type,
                id_document_number=id_document_number,
                nationality=nationality,
            )
            return {"success": True, "guest": updated}
        except Exception as e:
            db.rollback()
            logger.error(f"Guest update failed: {str(e)}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, guest_id: str) -> dict:
        guest = GuestRepository.get_by_id(db, tenant_id, guest_id)
        if not guest:
            return {"success": False, "error_code": "GUEST_NOT_FOUND"}

        GuestRepository.update(db, guest, is_active=False)
        logger.info(f"Guest deactivated: {guest_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
