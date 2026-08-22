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
        fiscal_year_id: str | None,
        q: str | None,
        bs_from: str | None,
        bs_to: str | None,
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
        if fiscal_year_id:
            query = query.filter(IMSPurchase.fiscal_year_id == fiscal_year_id)
        # date_bs is "YYYY-MM-DD" — lexical comparison sorts correctly,
        # same as restro_order.placed_at_bs (see api/utils/bikram_sambat.py).
        if bs_from:
            query = query.filter(IMSPurchase.date_bs >= bs_from)
        if bs_to:
            query = query.filter(IMSPurchase.date_bs <= bs_to)
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
    def cost_history_for_variant(
        db: Session, tenant_id: str, variant_id: str, limit: int = 20
    ) -> list[tuple[IMSPurchaseLine, IMSPurchase]]:
        """Cost of this variant over time, newest first — sourced from past
        purchase lines rather than a dedicated history table, since
        IMSPurchaseLine.unit_cost already snapshots the cost paid on every
        purchase (purchases are append-only, so this is a stable log)."""
        return (
            db.query(IMSPurchaseLine, IMSPurchase)
            .join(IMSPurchase, IMSPurchaseLine.purchase_id == IMSPurchase.id)
            .filter(IMSPurchase.tenant_id == tenant_id, IMSPurchaseLine.variant_id == variant_id)
            .order_by(IMSPurchase.date.desc(), IMSPurchase.created_at.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def exists_for_party(db: Session, tenant_id: str, party_id: str) -> bool:
        exists_query = (
            db.query(IMSPurchase)
            .filter(IMSPurchase.tenant_id == tenant_id, IMSPurchase.party_id == party_id)
            .exists()
        )
        return db.query(exists_query).scalar()
