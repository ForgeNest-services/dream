import { apiClient } from "./api-client";

export type IrdExportFormat = "xlsx" | "pdf";

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

// ---------------------------------------------------------------------------
// IRD VAT register exports — only for VAT-registered tenants, owner/manager.
// Backend returns a file download (Content-Disposition attachment).
// ---------------------------------------------------------------------------

function irdExportPath(
  register:
    | "sales-register"
    | "annexure-13"
    | "monthly-vat-summary"
    | "standard-view"
    | "credit-notes",
  format: IrdExportFormat,
  branchId: string,
  bsFrom: string,
  bsTo: string,
): string {
  const q = new URLSearchParams({ format, branch_id: branchId, bs_from: bsFrom, bs_to: bsTo });
  return `/restro/reports/${register}/export?${q}`;
}

export const irdExportsApi = {
  salesRegister(branchId: string, bsFrom: string, bsTo: string, format: IrdExportFormat) {
    return apiClient.download(
      irdExportPath("sales-register", format, branchId, bsFrom, bsTo),
      `sales-register.${format}`,
    );
  },
  annexure13(branchId: string, bsFrom: string, bsTo: string, format: IrdExportFormat) {
    return apiClient.download(
      irdExportPath("annexure-13", format, branchId, bsFrom, bsTo),
      `annexure-13.${format}`,
    );
  },
  monthlyVatSummary(branchId: string, bsFrom: string, bsTo: string, format: IrdExportFormat) {
    return apiClient.download(
      irdExportPath("monthly-vat-summary", format, branchId, bsFrom, bsTo),
      `monthly-vat-summary.${format}`,
    );
  },
  // IRD: Electronic Billing Procedure 2082, Annexure-5 — the 20-field
  // Standard View, all bills regardless of VAT registration status.
  standardView(branchId: string, bsFrom: string, bsTo: string, format: IrdExportFormat) {
    return apiClient.download(
      irdExportPath("standard-view", format, branchId, bsFrom, bsTo),
      `standard-view.${format}`,
    );
  },
  creditNotes(branchId: string, bsFrom: string, bsTo: string, format: IrdExportFormat) {
    return apiClient.download(
      irdExportPath("credit-notes", format, branchId, bsFrom, bsTo),
      `credit-notes.${format}`,
    );
  },
};
