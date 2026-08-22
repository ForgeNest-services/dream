import { apiClient } from "./api-client";

// qty/unit_cost/items_total/bill_amount/paid_amount/vat_amount are Decimal
// on the backend — serialized as JSON strings. Call Number() before
// arithmetic (see app-store.tsx's num()).
export interface PurchaseLineDto {
  id: string;
  product_id: string;
  variant_id: string;
  description: string;
  qty: number | string;
  unit_id: string;
  unit_cost: number | string;
  taxable: boolean;
  tax_rate: number | string;
  vat_amount: number | string;
}

export interface PurchaseDto {
  id: string;
  tenant_id: string;
  number: string;
  date: string;
  date_bs: string;
  branch_id: string;
  party_id: string | null;
  bill_no: string | null;
  items_total: number | string;
  bill_amount: number | string;
  paid_amount: number | string;
  payment_method: string;
  post_to_ledger: boolean;
  note: string | null;
  user_id: string;
  created_at: string;
  lines: PurchaseLineDto[];
}

export interface PurchaseNewItemRowPayload {
  name: string;
  model_no: string;
  barcode: string;
  unit_id: string;
  qty: number;
  unit_cost: number;
  selling_price: number;
  low_stock_at: number;
  expiry_date?: string | undefined;
}

export interface PurchaseExistingItemRowPayload {
  variant_id: string;
  qty: number;
  unit_cost: number;
  selling_price: number;
  expiry_date?: string | undefined;
}

export type PurchaseItemPayload =
  | {
      kind: "new";
      name: string;
      sku: string;
      category_id: string;
      brand_id?: string | undefined;
      media_id?: string | undefined;
      taxable: boolean;
      tax_rate?: number | undefined;
      rows: PurchaseNewItemRowPayload[];
    }
  | {
      kind: "existing";
      product_id: string;
      rows: PurchaseExistingItemRowPayload[];
    };

export interface CreatePurchasePayload {
  date: string;
  branch_id: string;
  party_id?: string | undefined;
  bill_no?: string | undefined;
  note?: string | undefined;
  bill_amount: number;
  paid_amount: number;
  payment_method: string;
  post_to_ledger: boolean;
  items: PurchaseItemPayload[];
  default_vat_rate: number;
}

export const purchasesApi = {
  list(
    params: {
      branch_id?: string;
      party_id?: string;
      q?: string;
      bs_from?: string;
      bs_to?: string;
      page?: number;
      per_page?: number;
    } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set("branch_id", params.branch_id);
    if (params.party_id) qs.set("party_id", params.party_id);
    if (params.q) qs.set("q", params.q);
    if (params.bs_from) qs.set("bs_from", params.bs_from);
    if (params.bs_to) qs.set("bs_to", params.bs_to);
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 25));
    return apiClient.get<PurchaseDto[]>(`/ims/purchases?${qs.toString()}`);
  },
  create(payload: CreatePurchasePayload) {
    return apiClient.post<PurchaseDto>("/ims/purchases", payload);
  },
};
