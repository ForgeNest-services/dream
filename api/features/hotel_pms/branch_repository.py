from sqlalchemy.orm import Session
from shared_models import HotelPMSBranch


class HotelPMSBranchRepository:
    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        name: str,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
    ) -> HotelPMSBranch:
        branch = HotelPMSBranch(
            tenant_id=tenant_id,
            name=name,
            address=address,
            city=city,
            phone=phone,
        )
        db.add(branch)
        db.commit()
        db.refresh(branch)
        return branch

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, branch_id: str) -> HotelPMSBranch | None:
        return (
            db.query(HotelPMSBranch)
            .filter(
                HotelPMSBranch.id == branch_id,
                HotelPMSBranch.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[HotelPMSBranch]:
        return (
            db.query(HotelPMSBranch)
            .filter(HotelPMSBranch.tenant_id == tenant_id)
            .order_by(HotelPMSBranch.created_at)
            .all()
        )

    @staticmethod
    def update(
        db: Session,
        branch: HotelPMSBranch,
        name: str | None = None,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
        is_active: bool | None = None,
    ) -> HotelPMSBranch:
        if name is not None:
            branch.name = name
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
