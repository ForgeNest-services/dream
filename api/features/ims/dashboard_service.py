from datetime import datetime, timezone
from sqlalchemy.orm import Session
from features.ims.dashboard_repository import IMSDashboardRepository
from features.ims.nepali_date import current_fiscal_year_start
from utils.bikram_sambat import to_bs_iso


class IMSDashboardService:
    @staticmethod
    def get(
        db: Session,
        tenant_id: str,
        branch_id: str | None,
        bs_from: str | None,
        bs_to: str | None,
    ) -> dict:
        # Sales trend needs a concrete range to fill zero-days in — falls
        # back to the current fiscal year's Shrawan-1-to-today span when the
        # caller doesn't pass one, rather than silently returning an empty
        # chart.
        start_year = current_fiscal_year_start()
        today_bs = to_bs_iso(datetime.now(timezone.utc)) or f"{start_year}-04-01"
        trend_from = bs_from or f"{start_year}-04-01"
        trend_to = bs_to or today_bs

        sales = IMSDashboardRepository.sales_summary(db, tenant_id, branch_id, bs_from, bs_to)
        balances = IMSDashboardRepository.receivables_payables(db, tenant_id)
        stock = IMSDashboardRepository.stock_health(db, tenant_id, branch_id)
        trend = IMSDashboardRepository.sales_trend(db, tenant_id, branch_id, trend_from, trend_to)
        by_category = IMSDashboardRepository.sales_by_category(db, tenant_id, branch_id, bs_from, bs_to)
        top_sellers = IMSDashboardRepository.top_sellers(db, tenant_id, branch_id, bs_from, bs_to, 8)
        low_stock = IMSDashboardRepository.low_stock_alerts(db, tenant_id, branch_id, 8)
        movements = IMSDashboardRepository.recent_movements(db, tenant_id, branch_id, 8)

        return {
            "success": True,
            "sales_total": sales["total"],
            "sales_count": sales["count"],
            "receivable": balances["receivable"],
            "payable": balances["payable"],
            "stock_value": stock["stock_value"],
            "low_stock_count": stock["low_stock_count"],
            "sales_trend": trend,
            "sales_by_category": by_category,
            "top_sellers": top_sellers,
            "low_stock_alerts": low_stock,
            "recent_movements": movements,
        }
