from sqlalchemy.orm import Session, joinedload
from shared_models import IMSInvoice, IMSInvoiceLine, IMSParty


class IMSInvoiceRepository:
    @staticmethod
    def create(db: Session, tenant_id: str, **fields) -> IMSInvoice:
        invoice = IMSInvoice(tenant_id=tenant_id, **fields)
        db.add(invoice)
        db.flush()
        return invoice

    @staticmethod
    def add_line(db: Session, invoice_id: str, **fields) -> IMSInvoiceLine:
        line = IMSInvoiceLine(invoice_id=invoice_id, **fields)
        db.add(line)
        return line

    @staticmethod
    def count_for_tenant(db: Session, tenant_id: str) -> int:
        return db.query(IMSInvoice).filter(IMSInvoice.tenant_id == tenant_id).count()

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, invoice_id: str) -> IMSInvoice | None:
        return (
            db.query(IMSInvoice)
            .options(joinedload(IMSInvoice.lines))
            .filter(IMSInvoice.id == invoice_id, IMSInvoice.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        customer_id: str | None,
        status: str | None,
        q: str | None,
        bs_from: str | None,
        bs_to: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[IMSInvoice], int]:
        from sqlalchemy import func, or_

        query = (
            db.query(IMSInvoice)
            .options(joinedload(IMSInvoice.lines))
            .filter(IMSInvoice.tenant_id == tenant_id)
        )
        if branch_id:
            query = query.filter(IMSInvoice.branch_id == branch_id)
        if customer_id:
            query = query.filter(IMSInvoice.customer_id == customer_id)
        if status:
            query = query.filter(IMSInvoice.status == status)
        # date_bs is "YYYY-MM-DD" — lexical comparison sorts correctly,
        # same as restro_order.placed_at_bs (see api/utils/bikram_sambat.py).
        if bs_from:
            query = query.filter(IMSInvoice.date_bs >= bs_from)
        if bs_to:
            query = query.filter(IMSInvoice.date_bs <= bs_to)
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.outerjoin(IMSParty, IMSParty.id == IMSInvoice.customer_id).filter(
                or_(
                    func.lower(IMSInvoice.number).like(term),
                    func.lower(IMSParty.name).like(term),
                )
            )
        total = query.distinct().count()
        items = (
            query.distinct()
            .order_by(IMSInvoice.date.desc(), IMSInvoice.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total
