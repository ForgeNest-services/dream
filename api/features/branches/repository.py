from sqlalchemy.orm import Session
from shared_models import Branch


class BranchRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        name: str,
        code: str,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
    ) -> Branch:
        branch = Branch(
            tenant_id=tenant_id,
            name=name,
            code=code,
            address=address,
            city=city,
            phone=phone,
        )
        db.add(branch)
        db.commit()
        db.refresh(branch)
        return branch

    @staticmethod
    def code_exists(db: Session, tenant_id: str, code: str, exclude_branch_id: str | None = None) -> bool:
        q = db.query(Branch).filter(Branch.tenant_id == tenant_id, Branch.code == code)
        if exclude_branch_id:
            q = q.filter(Branch.id != exclude_branch_id)
        return db.query(q.exists()).scalar()

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, branch_id: str) -> Branch | None:
        return (
            db.query(Branch)
            .filter(
                Branch.id == branch_id,
                Branch.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[Branch]:
        return (
            db.query(Branch)
            .filter(Branch.tenant_id == tenant_id)
            .order_by(Branch.created_at)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        branch: Branch,
        name: str | None = None,
        code: str | None = None,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
        is_active: bool | None = None,
    ) -> Branch:
        if name is not None:
            branch.name = name
        if code is not None:
            branch.code = code
        if address is not None:
            branch.address = address
        if city is not None:
            branch.city = city
        if phone is not None:
            branch.phone = phone
        if is_active is not None:
            branch.is_active = is_active
        db.commit()
        db.refresh(branch)
        return branch
