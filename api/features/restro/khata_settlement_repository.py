from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import func, desc
from sqlalchemy.orm import Session
from shared_models import RestroKhataSettlement
from utils.bikram_sambat import to_bs_iso


KHATA_SETTLEMENT_METHODS = {"cash", "qr"}


class KhataSettlementRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        customer_id: str,
        amount: Decimal,
        method: str,
        note: str | None,
        actor_name: str,
        actor_cred_id: str | None,
    ) -> RestroKhataSettlement:
        now = datetime.now(timezone.utc)
        row = RestroKhataSettlement(
            tenant_id=tenant_id,
            branch_id=branch_id,
            customer_id=customer_id,
            amount=amount,
            method=method,
            note=(note.strip() if note else None) or None,
            actor_name=actor_name,
            actor_cred_id=actor_cred_id,
            created_at=now,
            created_at_bs=to_bs_iso(now) or "",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def total_for_customer(db: Session, tenant_id: str, customer_id: str) -> Decimal:
        val = (
            db.query(func.coalesce(func.sum(RestroKhataSettlement.amount), 0))
            .filter(
                RestroKhataSettlement.tenant_id == tenant_id,
                RestroKhataSettlement.customer_id == customer_id,
            )
            .scalar()
        )
        return Decimal(val or 0)

    @staticmethod
    def list_for_customer(
        db: Session, tenant_id: str, customer_id: str, limit: int = 100
    ) -> list[RestroKhataSettlement]:
        return (
            db.query(RestroKhataSettlement)
            .filter(
                RestroKhataSettlement.tenant_id == tenant_id,
                RestroKhataSettlement.customer_id == customer_id,
            )
            .order_by(desc(RestroKhataSettlement.created_at))
            .limit(limit)
            .all()
        )
