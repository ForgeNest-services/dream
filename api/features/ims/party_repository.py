from sqlalchemy.orm import Session
from shared_models import IMSParty, IMSLedgerEntry


class IMSPartyRepository:
    @staticmethod
    def create(db: Session, tenant_id: str, **fields) -> IMSParty:
        party = IMSParty(tenant_id=tenant_id, **fields)
        db.add(party)
        db.commit()
        db.refresh(party)
        return party

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, party_id: str) -> IMSParty | None:
        return (
            db.query(IMSParty)
            .filter(IMSParty.id == party_id, IMSParty.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(
        db: Session,
        tenant_id: str,
        kind: str | None,
        q: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[IMSParty], int]:
        from sqlalchemy import func, or_

        query = db.query(IMSParty).filter(IMSParty.tenant_id == tenant_id)
        if kind:
            query = query.filter(IMSParty.kind == kind)
        if q:
            term = f"%{q.strip().lower()}%"
            query = query.filter(
                or_(
                    func.lower(IMSParty.name).like(term),
                    func.lower(IMSParty.phone).like(term),
                    func.lower(IMSParty.pan).like(term),
                )
            )
        total = query.count()
        items = query.order_by(IMSParty.name).offset(offset).limit(limit).all()
        return items, total

    @staticmethod
    def update(db: Session, party: IMSParty, **fields) -> IMSParty:
        for key, value in fields.items():
            setattr(party, key, value)
        db.commit()
        db.refresh(party)
        return party

    @staticmethod
    def delete(db: Session, party: IMSParty) -> None:
        db.delete(party)
        db.commit()


class IMSLedgerRepository:
    @staticmethod
    def create(db: Session, **fields) -> IMSLedgerEntry:
        entry = IMSLedgerEntry(**fields)
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def list_for_party(db: Session, tenant_id: str, party_id: str) -> list[IMSLedgerEntry]:
        return (
            db.query(IMSLedgerEntry)
            .filter(IMSLedgerEntry.tenant_id == tenant_id, IMSLedgerEntry.party_id == party_id)
            .order_by(IMSLedgerEntry.date)
            .all()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[IMSLedgerEntry]:
        return (
            db.query(IMSLedgerEntry)
            .filter(IMSLedgerEntry.tenant_id == tenant_id)
            .order_by(IMSLedgerEntry.date)
            .all()
        )

    @staticmethod
    def get_opening_balance_entry(
        db: Session, tenant_id: str, party_id: str
    ) -> IMSLedgerEntry | None:
        """The one "Opening balance" row posted at party creation, if any —
        used so editing opening_balance can correct that same entry in place
        instead of leaving it to silently disagree with the party record."""
        return (
            db.query(IMSLedgerEntry)
            .filter(
                IMSLedgerEntry.tenant_id == tenant_id,
                IMSLedgerEntry.party_id == party_id,
                IMSLedgerEntry.description == "Opening balance",
            )
            .first()
        )

    @staticmethod
    def update(db: Session, entry: IMSLedgerEntry, **fields) -> IMSLedgerEntry:
        for key, value in fields.items():
            setattr(entry, key, value)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def delete(db: Session, entry: IMSLedgerEntry) -> None:
        db.delete(entry)
        db.commit()
