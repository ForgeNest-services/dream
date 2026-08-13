from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.customer_repository import CustomerRepository
from features.branches.repository import BranchRepository
from utils.logger import logger


class CustomerService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    @staticmethod
    def _assert_customer(
        db: Session, tenant_id: str, branch_id: str, customer_id: str
    ):
        customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
        if not customer or not customer.is_active or customer.branch_id != branch_id:
            return None
        return customer

    @staticmethod
    def list_for_branch(
        db: Session, tenant_id: str, branch_id: str, search: str | None = None
    ) -> dict:
        if not CustomerService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        customers = CustomerRepository.list_for_branch(db, tenant_id, branch_id, search)
        return {"success": True, "customers": customers}

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        phone: str | None,
        address: str | None,
        notes: str | None,
    ) -> dict:
        if not CustomerService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        try:
            customer = CustomerRepository.create(
                db, tenant_id, branch_id, name, phone, address, notes
            )
            logger.info(
                f"Customer created: {customer.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "name": name},
            )
            return {"success": True, "customer": customer}
        except IntegrityError:
            db.rollback()
            # The only unique constraint is (branch_id, phone) partial. If we
            # ever collide, return the existing customer so the caller can pick
            # it instead of showing an error dead-end.
            existing = (
                CustomerRepository.find_by_phone(db, tenant_id, branch_id, phone or "")
                if phone
                else None
            )
            return {
                "success": False,
                "error_code": "PHONE_TAKEN",
                "existing_customer": existing,
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Customer create failed: {e}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        customer_id: str,
        name: str | None,
        phone: str | None,
        address: str | None,
        notes: str | None,
        is_active: bool | None,
        clear_phone: bool,
        clear_address: bool,
        clear_notes: bool,
    ) -> dict:
        customer = CustomerService._assert_customer(db, tenant_id, branch_id, customer_id)
        if not customer:
            return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}
        try:
            updated = CustomerRepository.update(
                db,
                customer,
                name=name,
                phone=phone,
                address=address,
                notes=notes,
                is_active=is_active,
                clear_phone=clear_phone,
                clear_address=clear_address,
                clear_notes=clear_notes,
            )
            return {"success": True, "customer": updated}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "PHONE_TAKEN"}
        except Exception as e:
            db.rollback()
            logger.error(f"Customer update failed: {e}")
            return {"success": False, "error_code": "UPDATE_FAILED"}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str, customer_id: str) -> dict:
        # Soft-delete only: khata orders reference customers by id, so a hard
        # delete would break the audit trail. Toggle is_active off instead —
        # customer disappears from pickers but their historical orders stay
        # navigable.
        customer = CustomerService._assert_customer(db, tenant_id, branch_id, customer_id)
        if not customer:
            return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}
        CustomerRepository.update(db, customer, is_active=False)
        return {"success": True}
