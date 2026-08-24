import { apiClient } from "./api-client";

// All numeric fields below are Decimal on the backend — serialized as JSON
// strings. Call Number() before arithmetic (see app-store.tsx's num()).

export interface StockSummaryRowDto {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  category_path: string;
  unit_symbol: string;
  stock_qty: number | string;
  low_stock_at: number;
  cost_price: number | string;
  selling_price: number | string;
  cost_value: number | string;
  retail_value: number | string;
}

export interface MarginRowDto {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  qty_sold: number | string;
  revenue: number | string;
  cost: number | string;
  profit: number | string;
  margin_pct: number | string;
}

export interface PartyStatementRowDto {
  party_id: string;
  name: string;
  pan: string | null;
  phone: string | null;
  period_debit: number | string;
  period_credit: number | string;
  balance: number | string;
}

export const reportsApi = {
  stockSummary(params: {
    branch_id?: string;
    category_id?: string;
    q?: string;
    low_stock_only?: boolean;
    page?: number;
    per_page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set("branch_id", params.branch_id);
    if (params.category_id) qs.set("category_id", params.category_id);
    if (params.q) qs.set("q", params.q);
    if (params.low_stock_only) qs.set("low_stock_only", "true");
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 25));
    return apiClient.get<StockSummaryRowDto[]>(`/ims/reports/stock-summary?${qs.toString()}`);
  },
  margin(params: {
    branch_id?: string;
    category_id?: string;
    bs_from?: string;
    bs_to?: string;
    page?: number;
    per_page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set("branch_id", params.branch_id);
    if (params.category_id) qs.set("category_id", params.category_id);
    if (params.bs_from) qs.set("bs_from", params.bs_from);
    if (params.bs_to) qs.set("bs_to", params.bs_to);
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 25));
    return apiClient.get<MarginRowDto[]>(`/ims/reports/margin?${qs.toString()}`);
  },
  partyStatement(params: {
    kind: "customer" | "supplier";
    q?: string;
    bs_from?: string;
    bs_to?: string;
    page?: number;
    per_page?: number;
  }) {
    const qs = new URLSearchParams();
    qs.set("kind", params.kind);
    if (params.q) qs.set("q", params.q);
    if (params.bs_from) qs.set("bs_from", params.bs_from);
    if (params.bs_to) qs.set("bs_to", params.bs_to);
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 25));
    return apiClient.get<PartyStatementRowDto[]>(`/ims/reports/party-statement?${qs.toString()}`);
  },
};
