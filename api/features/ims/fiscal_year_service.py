from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.ims.fiscal_year_repository import IMSFiscalYearRepository
from features.ims.nepali_date import current_fiscal_year_start
from utils.logger import logger


class IMSFiscalYearService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list:
        years = IMSFiscalYearRepository.list_for_tenant(db, tenant_id)
        if not years:
            current = current_fiscal_year_start()
            for start_year in (current - 2, current - 1, current):
                IMSFiscalYearRepository.create(
                    db, tenant_id, start_year, is_active=(start_year == current)
                )
            logger.info(f"IMS fiscal years seeded for tenant {tenant_id}, current={current}")
            years = IMSFiscalYearRepository.list_for_tenant(db, tenant_id)
        return years

    @staticmethod
    def create(db: Session, tenant_id: str, start_year: int) -> dict:
        try:
            fy = IMSFiscalYearRepository.create(db, tenant_id, start_year, is_active=False)
            logger.info(f"IMS fiscal year created: {fy.id}", extra={"tenant_id": tenant_id})
            return {"success": True, "fiscal_year": fy}
        except IntegrityError:
            db.rollback()
            return {"success": False, "error_code": "YEAR_EXISTS"}

    @staticmethod
    def set_active(db: Session, tenant_id: str, fy_id: str) -> dict:
        fy = IMSFiscalYearRepository.get_by_id(db, tenant_id, fy_id)
        if not fy:
            return {"success": False, "error_code": "FISCAL_YEAR_NOT_FOUND"}
        IMSFiscalYearRepository.deactivate_all(db, tenant_id)
        updated = IMSFiscalYearRepository.set_active(db, fy)
        logger.info(f"IMS fiscal year activated: {fy_id}", extra={"tenant_id": tenant_id})
        return {"success": True, "fiscal_year": updated}

    @staticmethod
    def get_active(db: Session, tenant_id: str) -> dict:
        years = IMSFiscalYearService.list_for_tenant(db, tenant_id)
        active = next((y for y in years if y.is_active), years[-1] if years else None)
        if not active:
            return {"success": False, "error_code": "NO_FISCAL_YEAR"}
        return {"success": True, "fiscal_year": active}
