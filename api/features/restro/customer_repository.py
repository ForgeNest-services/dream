from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from shared_models import RestroCustomer, RestroOrder


class CustomerRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str,
        phone: str | None,
        address: str | None,
        notes: str | None,
    ) -> RestroCustomer:
        customer = RestroCustomer(
            tenant_id=tenant_id,
            branch_id=branch_id,
            name=name.strip(),
            phone=(phone or "").strip() or None,
            address=(address or "").strip() or None,
            notes=(notes or "").strip() or None,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, customer_id: str) -> RestroCustomer | None:
        return (
            db.query(RestroCustomer)
            .filter(
                RestroCustomer.id == customer_id,
                RestroCustomer.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def find_by_phone(
        db: Session, tenant_id: str, branch_id: str, phone: str
    ) -> RestroCustomer | None:
        phone = phone.strip()
        if not phone:
            return None
        return (
            db.query(RestroCustomer)
            .filter(
                RestroCustomer.tenant_id == tenant_id,
                RestroCustomer.branch_id == branch_id,
                RestroCustomer.phone == phone,
                RestroCustomer.is_active == True,
            )
            .first()
        )

    @staticmethod
    def list_for_branch(
        db: Session,
        tenant_id: str,
        branch_id: str,
        search: str | None = None,
    ) -> list[RestroCustomer]:
        q = db.query(RestroCustomer).filter(
            RestroCustomer.tenant_id == tenant_id,
            RestroCustomer.branch_id == branch_id,
            RestroCustomer.is_active == True,
        )
        if search:
            like = f"%{search.strip()}%"
            q = q.filter(
                or_(
                    RestroCustomer.name.ilike(like),
                    RestroCustomer.phone.ilike(like),
                )
            )
        return q.order_by(RestroCustomer.name).all()

    @staticmethod
    def list_khata_orders(
        db: Session, tenant_id: str, customer_id: str, limit: int = 100
    ) -> list[RestroOrder]:
        """Every khata order for this customer (settled + unsettled), newest
        first. Includes closed and cancelled — the log should show everything
        that ever hit the tab, not just the live balance."""
        return (
            db.query(RestroOrder)
            .filter(
                RestroOrder.tenant_id == tenant_id,
                RestroOrder.customer_id == customer_id,
                RestroOrder.payment_method == "khata",
            )
            .order_by(desc(RestroOrder.placed_at))
            .limit(limit)
            .all()
        )

    @staticmethod
    def list_all_orders(
        db: Session, tenant_id: str, customer_id: str, limit: int = 100
    ) -> list[RestroOrder]:
        """Every order attached to this customer, regardless of payment
        method or status — cash, qr, khata, draft, cancelled, all of it.
        Used by the customer-detail history view so a manager can see the
        full activity for a repeat visitor (not just khata)."""
        return (
            db.query(RestroOrder)
            .filter(
                RestroOrder.tenant_id == tenant_id,
                RestroOrder.customer_id == customer_id,
            )
            .order_by(desc(RestroOrder.placed_at))
            .limit(limit)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        customer: RestroCustomer,
        name: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        notes: str | None = None,
        is_active: bool | None = None,
        clear_phone: bool = False,
        clear_address: bool = False,
        clear_notes: bool = False,
    ) -> RestroCustomer:
        if name is not None:
            customer.name = name.strip()
        if clear_phone:
            customer.phone = None
        elif phone is not None:
            customer.phone = phone.strip() or None
        if clear_address:
            customer.address = None
        elif address is not None:
            customer.address = address.strip() or None
        if clear_notes:
            customer.notes = None
        elif notes is not None:
            customer.notes = notes.strip() or None
        if is_active is not None:
            customer.is_active = is_active
        db.commit()
        db.refresh(customer)
        return customer
