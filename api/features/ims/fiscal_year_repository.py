from sqlalchemy.orm import Session
from shared_models import IMSFiscalYear


class IMSFiscalYearRepository:
    @staticmethod
    def create(db: Session, tenant_id: str, start_year: int, is_active: bool) -> IMSFiscalYear:
        fy = IMSFiscalYear(tenant_id=tenant_id, start_year=start_year, is_active=is_active)
        db.add(fy)
        db.commit()
        db.refresh(fy)
        return fy

    @staticmethod
    def get_by_id(db: Session, tenant_id: str, fy_id: str) -> IMSFiscalYear | None:
        return (
            db.query(IMSFiscalYear)
            .filter(IMSFiscalYear.id == fy_id, IMSFiscalYear.tenant_id == tenant_id)
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[IMSFiscalYear]:
        return (
            db.query(IMSFiscalYear)
            .filter(IMSFiscalYear.tenant_id == tenant_id)
            .order_by(IMSFiscalYear.start_year)
            .all()
        )

    @staticmethod
    def get_or_create_by_start_year(db: Session, tenant_id: str, start_year: int) -> IMSFiscalYear:
        """Resolve the fiscal year row for a transaction's own date (see
        nepali_date.fiscal_year_start_for_bs_date) — not necessarily the
        currently-active one. Auto-creates the row if it doesn't exist yet:
        the auto-seed in fiscal_year_service only covers the last 3 years
        around "today", so a purchase/sale backdated further back, or a
        pre-dated future entry, can land outside that window."""
        fy = (
            db.query(IMSFiscalYear)
            .filter(IMSFiscalYear.tenant_id == tenant_id, IMSFiscalYear.start_year == start_year)
            .first()
        )
        if fy:
            return fy
        fy = IMSFiscalYear(tenant_id=tenant_id, start_year=start_year, is_active=False)
        db.add(fy)
        db.flush()
        return fy

    @staticmethod
    def get_active(db: Session, tenant_id: str) -> IMSFiscalYear | None:
        return (
            db.query(IMSFiscalYear)
            .filter(IMSFiscalYear.tenant_id == tenant_id, IMSFiscalYear.is_active == True)
            .first()
        )

    @staticmethod
    def deactivate_all(db: Session, tenant_id: str) -> None:
        db.query(IMSFiscalYear).filter(IMSFiscalYear.tenant_id == tenant_id).update(
            {"is_active": False}
        )
        db.commit()

    @staticmethod
    def set_active(db: Session, fy: IMSFiscalYear) -> IMSFiscalYear:
        fy.is_active = True
        db.commit()
        db.refresh(fy)
        return fy

    @staticmethod
    def delete(db: Session, fy: IMSFiscalYear) -> None:
        db.delete(fy)
        db.commit()
