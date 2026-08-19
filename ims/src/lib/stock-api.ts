import { apiClient } from "./api-client";

export interface StockMovementDto {
  id: string;
  tenant_id: string;
  date: string;
  branch_id: string;
  product_id: string;
  variant_id: string;
  type: "restock" | "adjust-in" | "adjust-out" | "sale" | "transfer";
  qty: number;
  unit_cost: number | null;
  balance_after: number;
  reason: string | null;
  reference: string | null;
  supplier_id: string | null;
  user_id: string;
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
  movements(params: { branch_id?: string; variant_id?: string; page?: number; per_page?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set("branch_id", params.branch_id);
    if (params.variant_id) qs.set("variant_id", params.variant_id);
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 100));
    return apiClient.get<StockMovementDto[]>(`/ims/stock/movements?${qs.toString()}`);
  },
};
