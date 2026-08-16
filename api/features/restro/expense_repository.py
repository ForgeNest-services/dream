from decimal import Decimal
from sqlalchemy import desc
from sqlalchemy.orm import Session
from shared_models import RestroExpense


class ExpenseRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        category: str,
        amount: Decimal,
        note: str | None,
        spent_at_bs: str,
        actor_name: str,
        actor_cred_id: str | None,
    ) -> RestroExpense:
        exp = RestroExpense(
            tenant_id=tenant_id,
            branch_id=branch_id,
            category=category.strip() or "Other",
            amount=amount,
            note=(note.strip() if note else None) or None,
            spent_at_bs=spent_at_bs,
            actor_name=actor_name,
            actor_cred_id=actor_cred_id,
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return exp

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, expense_id: str) -> RestroExpense | None:
        return (
            db.query(RestroExpense)
            .filter(
                RestroExpense.id == expense_id,
                RestroExpense.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_branch(
        db: Session,
        tenant_id: str,
        branch_id: str,
        bs_from: str | None = None,
        bs_to: str | None = None,
    ) -> list[RestroExpense]:
        q = db.query(RestroExpense).filter(
            RestroExpense.tenant_id == tenant_id,
            RestroExpense.branch_id == branch_id,
        )
        if bs_from:
            q = q.filter(RestroExpense.spent_at_bs >= bs_from)
        if bs_to:
            q = q.filter(RestroExpense.spent_at_bs <= bs_to)
        return q.order_by(desc(RestroExpense.spent_at_bs), desc(RestroExpense.created_at)).all()

    @staticmethod
    def update(
        db: Session,
        expense: RestroExpense,
        category: str | None = None,
        amount: Decimal | None = None,
        note: str | None = None,
        spent_at_bs: str | None = None,
        clear_note: bool = False,
    ) -> RestroExpense:
        if category is not None:
            expense.category = category.strip() or "Other"
        if amount is not None:
            expense.amount = amount
        if clear_note:
            expense.note = None
        elif note is not None:
            expense.note = note.strip() or None
        if spent_at_bs is not None:
            expense.spent_at_bs = spent_at_bs
        db.commit()
        db.refresh(expense)
        return expense

    @staticmethod
    def delete(db: Session, expense: RestroExpense) -> None:
        db.delete(expense)
        db.commit()
