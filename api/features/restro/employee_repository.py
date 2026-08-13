from decimal import Decimal
from sqlalchemy.orm import Session
from shared_models import RestroEmployee


class EmployeeRepository:
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
    ) -> RestroEmployee:
        employee = RestroEmployee(
            tenant_id=tenant_id,
            branch_id=branch_id,
            name=name.strip(),
            designation=designation.strip() or "Waiter",
            phone=(phone or "").strip(),
            email=(email or "").strip() or None,
            salary=salary,
            shift=(shift or "").strip() or None,
        )
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return employee

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, employee_id: str) -> RestroEmployee | None:
        return (
            db.query(RestroEmployee)
            .filter(
                RestroEmployee.id == employee_id,
                RestroEmployee.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_branch(db: Session, tenant_id: str, branch_id: str) -> list[RestroEmployee]:
        # Active first (both true+false sorted, but active shows on top via desc()
        # on the bool cast); within each group, alphabetical.
        return (
            db.query(RestroEmployee)
            .filter(
                RestroEmployee.tenant_id == tenant_id,
                RestroEmployee.branch_id == branch_id,
            )
            .order_by(RestroEmployee.is_active.desc(), RestroEmployee.name)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        employee: RestroEmployee,
        name: str | None = None,
        designation: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        salary: Decimal | None = None,
        shift: str | None = None,
        is_active: bool | None = None,
        clear_email: bool = False,
        clear_shift: bool = False,
    ) -> RestroEmployee:
        if name is not None:
            employee.name = name.strip()
        if designation is not None:
            employee.designation = designation.strip() or "Waiter"
        if phone is not None:
            employee.phone = phone.strip()
        if clear_email:
            employee.email = None
        elif email is not None:
            employee.email = email.strip() or None
        if salary is not None:
            employee.salary = salary
        if clear_shift:
            employee.shift = None
        elif shift is not None:
            employee.shift = shift.strip() or None
        if is_active is not None:
            employee.is_active = is_active
        db.commit()
        db.refresh(employee)
        return employee

    @staticmethod
    def delete(db: Session, employee: RestroEmployee) -> None:
        # Employees can be hard-deleted since there are no FK dependents
        # (unlike credentials, which back shifts / orders). Owner explicit
        # action — the "active" toggle is the soft alternative already.
        db.delete(employee)
        db.commit()
