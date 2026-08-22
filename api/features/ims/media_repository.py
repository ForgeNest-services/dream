from sqlalchemy.orm import Session
from shared_models import IMSMedia


class IMSMediaRepository:
    @staticmethod
    def create(
        db: Session, tenant_id: str, name: str, url: str, folder: str, size_kb: int
    ) -> IMSMedia:
        item = IMSMedia(tenant_id=tenant_id, name=name, url=url, folder=folder, size_kb=size_kb)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, media_id: str) -> IMSMedia | None:
        return (
            db.query(IMSMedia)
            .filter(IMSMedia.id == media_id, IMSMedia.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str, q: str | None) -> list[IMSMedia]:
        from sqlalchemy import func

        query = db.query(IMSMedia).filter(IMSMedia.tenant_id == tenant_id)
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.filter(
                func.lower(IMSMedia.name).like(term) | func.lower(IMSMedia.folder).like(term)
            )
        return query.order_by(IMSMedia.uploaded_at.desc()).all()

    @staticmethod
    def delete(db: Session, item: IMSMedia) -> None:
        db.delete(item)
        db.commit()
