import { apiClient } from "./api-client";

// NOTE: fields typed `number | string` are Decimal on the backend, which
// Pydantic serializes as a JSON string (e.g. "cost_price": "18.00"). Every
// consumer MUST call Number() on these before doing arithmetic — see
// app-store.tsx's num()/numOrUndefined() helpers.

export interface VariantStockDto {
  branch_id: string;
  qty: number | string;
}

export interface VariantDto {
  id: string;
  product_id: string;
  name: string;
  model_no: string | null;
  barcode: string | null;
  unit_id: string;
  purchase_unit_id: string | null;
  conversion_factor: number | string | null;
  cost_price: number | string;
  selling_price: number | string;
  low_stock_at: number;
  stock: VariantStockDto[];
}

export interface ProductDto {
  id: string;
  tenant_id: string;
  name: string;
  sku: string;
  category_id: string;
  brand_id: string | null;
  media_id: string | null;
  description: string | null;
  taxable: boolean | null;
  tax_rate: number | string | null;
  created_at: string;
  updated_at: string;
  variants: VariantDto[];
}

export interface VariantInput {
  id?: string | undefined;
  name: string;
  model_no?: string | undefined;
  barcode?: string | undefined;
  unit_id: string;
  purchase_unit_id?: string | undefined;
  conversion_factor?: number | undefined;
  cost_price: number;
  selling_price: number;
  low_stock_at: number;
  initial_stock?: number | undefined;
}

export interface CreateProductPayload {
  name: string;
  sku: string;
  category_id: string;
  brand_id?: string | undefined;
  media_id?: string | undefined;
  description?: string | undefined;
  taxable: boolean;
  tax_rate?: number | undefined;
  branch_id_for_stock: string;
  variants: VariantInput[];
}

export interface UpdateProductPayload {
  name: string;
  sku: string;
  category_id: string;
  brand_id?: string | undefined;
  media_id?: string | undefined;
  description?: string | undefined;
  taxable: boolean;
  tax_rate?: number | undefined;
  variants: VariantInput[];
}

export interface ProductsQuery {
  q?: string;
  /** comma-separated category ids — pass a resolved root+descendants set */
  category_id?: string;
  brand_id?: string;
  stock_status?: "in-stock" | "low" | "out" | "";
  page?: number;
  per_page?: number;
}

export const productsApi = {
  list(params: ProductsQuery = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.category_id) qs.set("category_id", params.category_id);
    if (params.brand_id) qs.set("brand_id", params.brand_id);
    if (params.stock_status) qs.set("stock_status", params.stock_status);
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 25));
    return apiClient.get<ProductDto[]>(`/ims/products?${qs.toString()}`);
  },
  create(payload: CreateProductPayload) {
    return apiClient.post<ProductDto>("/ims/products", payload);
  },
  update(id: string, payload: UpdateProductPayload) {
    return apiClient.patch<ProductDto>(`/ims/products/${id}`, payload);
  },
  delete(id: string) {
    return apiClient.delete<{ deleted: boolean }>(`/ims/products/${id}`);
  },
};
