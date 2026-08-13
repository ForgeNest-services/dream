from decimal import Decimal
from sqlalchemy.orm import Session
from features.restro.employee_repository import EmployeeRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


class EmployeeService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def _assert_employee(db: Session, tenant_id: str, branch_id: str, employee_id: str):
        employee = EmployeeRepository.get_by_id(db, tenant_id, employee_id)
        if not employee or employee.branch_id != branch_id:
            return None
        return employee

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> dict:
        if not EmployeeService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        employees = EmployeeRepository.list_for_branch(db, tenant_id, branch_id)
        return {"success": True, "employees": employees}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        designation: str,
        phone: str,
        email: str | None,
        salary: Decimal,
        shift: str | None,
    ) -> dict:
        if not EmployeeService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if salary < 0:
            return {"success": False, "error_code": "INVALID_SALARY"}
        try:
            employee = EmployeeRepository.create(
                db, tenant_id, branch_id, name, designation, phone, email, salary, shift
            )
            logger.info(
                f"Employee created: {employee.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "name": name},
            )
            return {"success": True, "employee": employee}
        except Exception as e:
            db.rollback()
            logger.error(f"Employee create failed: {e}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        employee_id: str,
        name: str | None,
        designation: str | None,
        phone: str | None,
        email: str | None,
        salary: Decimal | None,
        shift: str | None,
        is_active: bool | None,
        clear_email: bool,
        clear_shift: bool,
    ) -> dict:
        employee = EmployeeService._assert_employee(db, tenant_id, branch_id, employee_id)
        if not employee:
            return {"success": False, "error_code": "EMPLOYEE_NOT_FOUND"}
        if salary is not None and salary < 0:
            return {"success": False, "error_code": "INVALID_SALARY"}
        try:
            updated = EmployeeRepository.update(
                db,
                employee,
                name=name,
                designation=designation,
                phone=phone,
                email=email,
                salary=salary,
                shift=shift,
                is_active=is_active,
                clear_email=clear_email,
                clear_shift=clear_shift,
            )
            return {"success": True, "employee": updated}
        except Exception as e:
            db.rollback()
            logger.error(f"Employee update failed: {e}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str, employee_id: str) -> dict:
        employee = EmployeeService._assert_employee(db, tenant_id, branch_id, employee_id)
        if not employee:
            return {"success": False, "error_code": "EMPLOYEE_NOT_FOUND"}
        EmployeeRepository.delete(db, employee)
        return {"success": True}
