from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from features.ims.party_repository import IMSPartyRepository, IMSLedgerRepository
from utils.logger import logger


class IMSPartyService:
    @staticmethod
    def list_for_tenant(
        db: Session, tenant_id: str, kind: str | None, q: str | None, offset: int, limit: int
    ) -> dict:
        items, total = IMSPartyRepository.list_for_tenant(db, tenant_id, kind, q, offset, limit)
        return {"parties": items, "total": total}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        name: str,
        kind: str,
        phone: str | None,
        email: str | None,
        address: str | None,
        pan: str | None,
        is_vat_registered: bool | None,
        credit_limit: Decimal | None,
        opening_balance: Decimal,
        terms: str | None,
    ) -> dict:
        party = IMSPartyRepository.create(
            db,
            tenant_id=tenant_id,
            name=name.strip(),
            kind=kind,
            phone=phone,
            email=email,
            address=address,
            pan=pan,
            is_vat_registered=is_vat_registered,
            credit_limit=credit_limit,
            opening_balance=opening_balance,
            terms=terms,
        )
        if opening_balance and opening_balance != 0:
            is_supplier = kind == "supplier"
            IMSLedgerRepository.create(
                db,
                tenant_id=tenant_id,
                party_id=party.id,
                date=datetime.now(timezone.utc),
                description="Opening balance",
                debit=opening_balance if not is_supplier else Decimal(0),
                credit=opening_balance if is_supplier else Decimal(0),
            )
        logger.info(f"IMS party created: {party.id}", extra={"tenant_id": tenant_id, "kind": kind})
        return {"success": True, "party": party}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        party_id: str,
        name: str,
        phone: str | None,
        email: str | None,
        address: str | None,
        pan: str | None,
        is_vat_registered: bool | None,
        credit_limit: Decimal | None,
        opening_balance: Decimal,
        terms: str | None,
    ) -> dict:
        party = IMSPartyRepository.get_by_id(db, tenant_id, party_id)
        if not party:
            return {"success": False, "error_code": "PARTY_NOT_FOUND"}

        party = IMSPartyRepository.update(
            db,
            party,
            name=name.strip(),
            phone=phone,
            email=email,
            address=address,
            pan=pan,
            is_vat_registered=is_vat_registered,
            credit_limit=credit_limit,
            opening_balance=opening_balance,
            terms=terms,
        )

        # Keep the "Opening balance" ledger row in sync with the party
        # record — it's the one entry allowed to be corrected in place
        # instead of staying append-only, so the two numbers never disagree.
        is_supplier = party.kind == "supplier"
        existing = IMSLedgerRepository.get_opening_balance_entry(db, tenant_id, party_id)
        if opening_balance and opening_balance != 0:
            debit = opening_balance if not is_supplier else Decimal(0)
            credit = opening_balance if is_supplier else Decimal(0)
            if existing:
                IMSLedgerRepository.update(db, existing, debit=debit, credit=credit)
            else:
                IMSLedgerRepository.create(
                    db,
                    tenant_id=tenant_id,
                    party_id=party_id,
                    date=datetime.now(timezone.utc),
                    description="Opening balance",
                    debit=debit,
                    credit=credit,
                )
        elif existing:
            IMSLedgerRepository.delete(db, existing)

        logger.info(f"IMS party updated: {party.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "party": party}

    @staticmethod
    def delete(db: Session, tenant_id: str, party_id: str) -> dict:
        party = IMSPartyRepository.get_by_id(db, tenant_id, party_id)
        if not party:
            return {"success": False, "error_code": "PARTY_NOT_FOUND"}
        # A purchase's party_id FK isn't cascade-deletable — purchases are
        # append-only records (see IMSPurchase's docstring), so a party with
        # purchase history can never be hard-deleted, unlike opening-balance
        # or payment-only ledger history which the party delete freely wipes.
        from features.ims.purchase_repository import IMSPurchaseRepository

        if IMSPurchaseRepository.exists_for_party(db, tenant_id, party_id):
            return {"success": False, "error_code": "HAS_PURCHASE_HISTORY"}
        IMSPartyRepository.delete(db, party)
        logger.info(f"IMS party deleted: {party_id}", extra={"tenant_id": tenant_id})
        return {"success": True}


class IMSLedgerService:
    @staticmethod
    def list_for_party(db: Session, tenant_id: str, party_id: str) -> dict:
        if not IMSPartyRepository.get_by_id(db, tenant_id, party_id):
            return {"success": False, "error_code": "PARTY_NOT_FOUND"}
        entries = IMSLedgerRepository.list_for_party(db, tenant_id, party_id)
        return {"success": True, "entries": entries}

    @staticmethod
    def balance_of(db: Session, tenant_id: str, party_id: str) -> Decimal:
        """Outstanding amount: payable for suppliers, receivable for
        customers. Mirrors the frontend's client-side partyBalance derivation."""
        party = IMSPartyRepository.get_by_id(db, tenant_id, party_id)
        is_supplier = party.kind == "supplier" if party else False
        entries = IMSLedgerRepository.list_for_party(db, tenant_id, party_id)
        total = Decimal(0)
        for e in entries:
            total += (e.credit - e.debit) if is_supplier else (e.debit - e.credit)
        return total

    @staticmethod
    def record_payment(
        db: Session,
        tenant_id: str,
        party_id: str,
        amount: Decimal,
        date: datetime,
        method: str,
        reference: str | None,
    ) -> dict:
        party = IMSPartyRepository.get_by_id(db, tenant_id, party_id)
        if not party:
            return {"success": False, "error_code": "PARTY_NOT_FOUND"}
        if amount <= 0:
            return {"success": False, "error_code": "INVALID_AMOUNT"}

        is_supplier = party.kind == "supplier"
        entry = IMSLedgerRepository.create(
            db,
            tenant_id=tenant_id,
            party_id=party_id,
            date=date,
            description=f"Payment {'made' if is_supplier else 'received'} ({method})",
            reference=reference,
            debit=amount if is_supplier else Decimal(0),
            credit=Decimal(0) if is_supplier else amount,
        )
        logger.info(
            f"IMS payment recorded: party={party_id} amount={amount}",
            extra={"tenant_id": tenant_id},
        )
        return {"success": True, "entry": entry}
