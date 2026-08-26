from sqlalchemy.orm import Session
from features.ims.reports_repository import IMSReportsRepository


class IMSReportsService:
    @staticmethod
    def stock_summary(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        category_id: str | None,
        q: str | None,
        low_stock_only: bool,
        offset: int,
        limit: int,
    ) -> dict:
        rows, total = IMSReportsRepository.stock_summary(
            db, tenant_id, branch_id, category_id, q, low_stock_only, offset, limit
        )
        return {"success": True, "rows": rows, "total": total}

    @staticmethod
    def margin(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        category_id: str | None,
        bs_from: str | None,
        bs_to: str | None,
        offset: int,
        limit: int,
    ) -> dict:
        rows, total = IMSReportsRepository.margin(
            db, tenant_id, branch_id, category_id, bs_from, bs_to, offset, limit
        )
        return {"success": True, "rows": rows, "total": total}

    @staticmethod
    def party_statement(
        db: Session,
        tenant_id: str,
        kind: str,
        q: str | None,
        bs_from: str | None,
        bs_to: str | None,
        offset: int,
        limit: int,
    ) -> dict:
        rows, total = IMSReportsRepository.party_statement(
            db, tenant_id, kind, q, bs_from, bs_to, offset, limit
        )
        return {"success": True, "rows": rows, "total": total}
