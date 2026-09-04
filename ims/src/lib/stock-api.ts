import { apiClient } from "./api-client";

// qty/unit_cost/balance_after are Decimal on the backend — serialized as
// JSON strings. Call Number() before arithmetic (see app-store.tsx's num()).
export interface StockMovementDto {
  id: string;
  tenant_id: string;
  date: string;
  date_bs: string;
  branch_id: string;
  product_id: string;
  variant_id: string;
  type: "restock" | "adjust-in" | "adjust-out" | "sale" | "transfer";
  qty: number | string;
  unit_cost: number | string | null;
  balance_after: number | string;
  reason: string | null;
  reference: string | null;
  supplier_id: string | null;
  user_id: string;
  // Resolved server-side from the credential's display name — null only if
  // that credential has since been deleted.
  user_name: string | null;
  created_at: string;
}

export const stockApi = {
  adjust(input: {
    variant_id: string;
    branch_id: string;
    qty: number;
    reason: string;
    date: string;
  }) {
    return apiClient.post<StockMovementDto>("/ims/stock/adjust", input);
  },
  restock(input: {
    variant_id: string;
    branch_id: string;
    qty: number;
    unit_cost: number;
    date: string;
    supplier_id?: string | undefined;
    reference?: string | undefined;
  }) {
    return apiClient.post<StockMovementDto>("/ims/stock/restock", input);
  },
  movements(
    params: {
      branch_id?: string;
      variant_id?: string;
      type?: string;
      q?: string;
      bs_from?: string;
      bs_to?: string;
      page?: number;
      per_page?: number;
    } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set("branch_id", params.branch_id);
    if (params.variant_id) qs.set("variant_id", params.variant_id);
    if (params.type) qs.set("type", params.type);
    if (params.q) qs.set("q", params.q);
    if (params.bs_from) qs.set("bs_from", params.bs_from);
    if (params.bs_to) qs.set("bs_to", params.bs_to);
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 25));
    return apiClient.get<StockMovementDto[]>(`/ims/stock/movements?${qs.toString()}`);
  },
};
