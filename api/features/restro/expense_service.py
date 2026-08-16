import re
from decimal import Decimal
from sqlalchemy.orm import Session

from features.restro.expense_repository import ExpenseRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


_BS_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _valid_bs_date(value: str) -> bool:
    """BS dates are stored as "YYYY-MM-DD" strings (same shape as
    order.placed_at_bs), sortable lexically. We only shape-check here —
    the frontend picker enforces the calendar-day validity."""
    return bool(value and _BS_DATE_RE.match(value))


class ExpenseService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def _assert_expense(db: Session, tenant_id: str, branch_id: str, expense_id: str):
        exp = ExpenseRepository.get_by_id(db, tenant_id, expense_id)
        if not exp or exp.branch_id != branch_id:
            return None
        return exp

    @staticmethod
    def list_for_branch(
        db: Session,
        tenant_id: str,
        branch_id: str,
        bs_from: str | None = None,
        bs_to: str | None = None,
    ) -> dict:
        if not ExpenseService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        expenses = ExpenseRepository.list_for_branch(db, tenant_id, branch_id, bs_from, bs_to)
        return {"success": True, "expenses": expenses}

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
    ) -> dict:
        if not ExpenseService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if amount <= 0:
            return {"success": False, "error_code": "INVALID_AMOUNT"}
        if not _valid_bs_date(spent_at_bs):
            return {"success": False, "error_code": "INVALID_DATE"}
        try:
            exp = ExpenseRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                category=category,
                amount=amount,
                note=note,
                spent_at_bs=spent_at_bs,
                actor_name=actor_name,
                actor_cred_id=actor_cred_id,
            )
            logger.info(
                f"Expense recorded: {exp.id} amount={amount}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "category": category},
            )
            return {"success": True, "expense": exp}
        except Exception as e:
            db.rollback()
            logger.error(f"Expense create failed: {e}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        expense_id: str,
        category: str | None,
        amount: Decimal | None,
        note: str | None,
        spent_at_bs: str | None,
        clear_note: bool,
    ) -> dict:
        exp = ExpenseService._assert_expense(db, tenant_id, branch_id, expense_id)
        if not exp:
            return {"success": False, "error_code": "EXPENSE_NOT_FOUND"}
        if amount is not None and amount <= 0:
            return {"success": False, "error_code": "INVALID_AMOUNT"}
        if spent_at_bs is not None and not _valid_bs_date(spent_at_bs):
            return {"success": False, "error_code": "INVALID_DATE"}
        try:
            updated = ExpenseRepository.update(
                db,
                exp,
                category=category,
                amount=amount,
                note=note,
                spent_at_bs=spent_at_bs,
                clear_note=clear_note,
            )
            return {"success": True, "expense": updated}
        except Exception as e:
            db.rollback()
            logger.error(f"Expense update failed: {e}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str, expense_id: str) -> dict:
        exp = ExpenseService._assert_expense(db, tenant_id, branch_id, expense_id)
        if not exp:
            return {"success": False, "error_code": "EXPENSE_NOT_FOUND"}
        ExpenseRepository.delete(db, exp)
        return {"success": True}
