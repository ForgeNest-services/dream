from sqlalchemy.orm import Session, joinedload
from shared_models import IMSPurchase, IMSPurchaseLine


class IMSPurchaseRepository:
    @staticmethod
    def create(db: Session, tenant_id: str, **fields) -> IMSPurchase:
        purchase = IMSPurchase(tenant_id=tenant_id, **fields)
        db.add(purchase)
        db.flush()
        return purchase

    @staticmethod
    def add_line(db: Session, purchase_id: str, **fields) -> IMSPurchaseLine:
        line = IMSPurchaseLine(purchase_id=purchase_id, **fields)
        db.add(line)
        return line

    @staticmethod
    def count_for_tenant(db: Session, tenant_id: str) -> int:
        return db.query(IMSPurchase).filter(IMSPurchase.tenant_id == tenant_id).count()

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, purchase_id: str) -> IMSPurchase | None:
        return (
            db.query(IMSPurchase)
            .options(joinedload(IMSPurchase.lines))
            .filter(IMSPurchase.id == purchase_id, IMSPurchase.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        party_id: str | None,
        q: str | None,
        date_from,
        date_to,
        offset: int,
        limit: int,
    ) -> tuple[list[IMSPurchase], int]:
        from sqlalchemy import func, or_

        query = (
            db.query(IMSPurchase)
            .options(joinedload(IMSPurchase.lines))
            .filter(IMSPurchase.tenant_id == tenant_id)
        )
        if branch_id:
            query = query.filter(IMSPurchase.branch_id == branch_id)
        if party_id:
            query = query.filter(IMSPurchase.party_id == party_id)
        if date_from:
            query = query.filter(IMSPurchase.date >= date_from)
        if date_to:
            query = query.filter(IMSPurchase.date <= date_to)
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.filter(
                or_(
                    func.lower(IMSPurchase.number).like(term),
                    func.lower(IMSPurchase.bill_no).like(term),
                )
            )
        total = query.distinct().count()
        items = (
            query.distinct()
            .order_by(IMSPurchase.date.desc(), IMSPurchase.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    @staticmethod
    def exists_for_party(db: Session, tenant_id: str, party_id: str) -> bool:
        exists_query = (
            db.query(IMSPurchase)
            .filter(IMSPurchase.tenant_id == tenant_id, IMSPurchase.party_id == party_id)
            .exists()
        )
        return db.query(exists_query).scalar()
