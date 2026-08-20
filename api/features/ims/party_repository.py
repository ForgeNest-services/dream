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
    def list_for_tenant(db: Session, tenant_id: str, kind: str | None) -> list[IMSParty]:
        query = db.query(IMSParty).filter(IMSParty.tenant_id == tenant_id)
        if kind:
            query = query.filter(IMSParty.kind == kind)
        return query.order_by(IMSParty.name).all()


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
