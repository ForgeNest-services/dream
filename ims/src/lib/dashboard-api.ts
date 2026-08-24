import { apiClient } from "./api-client";

// All numeric fields are Decimal on the backend — serialized as JSON
// strings. Call Number() before arithmetic.

export interface SalesTrendPointDto {
  date_bs: string;
  total: number | string;
}

export interface SalesByCategoryRowDto {
  category_id: string | null;
  category_name: string;
  total: number | string;
}

export interface TopSellerRowDto {
  variant_id: string;
  product_name: string;
  variant_name: string;
  qty_sold: number | string;
  revenue: number | string;
}

export interface LowStockAlertRowDto {
  variant_id: string;
  product_name: string;
  variant_name: string;
  stock_qty: number | string;
  low_stock_at: number;
}

export interface RecentMovementRowDto {
  id: string;
  date: string;
  product_name: string;
  variant_name: string;
  type: string;
  qty: number | string;
  balance_after: number | string;
}

export interface DashboardDataDto {
  sales_total: number | string;
  sales_count: number;
  receivable: number | string;
  payable: number | string;
  stock_value: number | string;
  low_stock_count: number;
  sales_trend: SalesTrendPointDto[];
  sales_by_category: SalesByCategoryRowDto[];
  top_sellers: TopSellerRowDto[];
  low_stock_alerts: LowStockAlertRowDto[];
  recent_movements: RecentMovementRowDto[];
}

export const dashboardApi = {
  get(params: { branch_id?: string; bs_from?: string; bs_to?: string }) {
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set("branch_id", params.branch_id);
    if (params.bs_from) qs.set("bs_from", params.bs_from);
    if (params.bs_to) qs.set("bs_to", params.bs_to);
    return apiClient.get<DashboardDataDto>(`/ims/dashboard?${qs.toString()}`);
  },
};
