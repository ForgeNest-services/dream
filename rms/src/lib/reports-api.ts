import { apiClient } from "./api-client";

// Money is serialized as strings on the wire to preserve Decimal precision.
// Parse to Number for display (NPR helpers), keep the raw string if you ever
// need exact math.
export interface CategoryBreakdown {
  category: string;
  qty: number;
  revenue: string;
}

export interface PaymentBucket {
  amount: string;
  count: number;
}

export interface ExpenseBreakdown {
  category: string;
  amount: string;
}

export interface SummaryDto {
  bs_from: string | null;
  bs_to: string | null;
  orders: { placed: number; paid: number; draft: number; cancelled: number };
  items_sold: number;
  sales_gross: string;
  expenses_total: string;
  net: string;
  by_category: CategoryBreakdown[];
  by_payment: {
    cash: PaymentBucket;
    qr: PaymentBucket;
    khata: PaymentBucket;
  };
  expenses_by_category: ExpenseBreakdown[];
}

export interface TopItemDto {
  name: string;
  variant_name: string | null;
  qty: number;
  revenue: string;
}

export interface TrendRowDto {
  bs_date: string;
  sales: string;
  orders: number;
  expenses: string;
}

export interface DashboardDto {
  anchor_bs: string;
  today: SummaryDto;
  yesterday_sales: string;
  trend_7_days: TrendRowDto[];
  top_items: TopItemDto[];
  tables: { occupied: number; total: number };
  low_stock_count: number;
}

export const reportsApi = {
  dashboard(branchId: string, bs?: string) {
    const q = bs ? `?bs=${encodeURIComponent(bs)}` : "";
    return apiClient.get<DashboardDto>(
      `/restro/branches/${branchId}/reports/dashboard${q}`,
    );
  },
  dailySummary(branchId: string, bs: string) {
    return apiClient.get<SummaryDto>(
      `/restro/branches/${branchId}/reports/daily-summary?bs=${encodeURIComponent(bs)}`,
    );
  },
  rangeSummary(branchId: string, bsFrom: string, bsTo: string) {
    const q = new URLSearchParams({ bs_from: bsFrom, bs_to: bsTo });
    return apiClient.get<SummaryDto>(
      `/restro/branches/${branchId}/reports/range-summary?${q}`,
    );
  },
  salesTrend(branchId: string, bsFrom: string, bsTo: string) {
    const q = new URLSearchParams({ bs_from: bsFrom, bs_to: bsTo });
    return apiClient.get<TrendRowDto[]>(
      `/restro/branches/${branchId}/reports/sales-trend?${q}`,
    );
  },
  topItems(branchId: string, bsFrom: string, bsTo: string, limit = 10) {
    const q = new URLSearchParams({
      bs_from: bsFrom,
      bs_to: bsTo,
      limit: String(limit),
    });
    return apiClient.get<TopItemDto[]>(
      `/restro/branches/${branchId}/reports/top-items?${q}`,
    );
  },
};

// Numeric helper — Decimal-safe-enough for display. Backend values fit in
// f64 comfortably (Nepal restaurant scale is <1e10).
export const asNum = (v: string | number | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0);
