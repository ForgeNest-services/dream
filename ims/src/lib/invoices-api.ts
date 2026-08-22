import { apiClient } from "./api-client";

// qty/rate/discount/gross_amount/taxable_amount/vat_amount/total_amount/
// paid_amount are Decimal on the backend — serialized as JSON strings. Call
// Number() before arithmetic (see app-store.tsx's num()).
export interface InvoiceLineDto {
  id: string;
  product_id: string;
  variant_id: string;
  description: string;
  qty: number | string;
  unit_id: string;
  rate: number | string;
  discount: number | string;
  taxable: boolean;
  tax_rate: number | string;
  vat_amount: number | string;
}

export interface InvoiceDto {
  id: string;
  tenant_id: string;
  number: string;
  kind: "tax" | "abbreviated" | "quotation";
  date: string;
  date_bs: string;
  fiscal_year_id: string | null;
  branch_id: string;
  customer_id: string;
  gross_amount: number | string;
  discount_amount: number | string;
  taxable_amount: number | string;
  exempt_amount: number | string;
  vat_amount: number | string;
  total_amount: number | string;
  payment_method: string;
  paid_amount: number | string;
  status: "paid" | "partial" | "unpaid";
  note: string | null;
  user_id: string;
  created_at: string;
  lines: InvoiceLineDto[];
}

export interface InvoiceLinePayload {
  variant_id: string;
  qty: number;
  rate: number;
  discount?: number | undefined;
  taxable?: boolean | undefined;
}

export interface CreateInvoicePayload {
  date: string;
  branch_id: string;
  customer_id: string;
  payment_method: string;
  paid_amount: number;
  note?: string | undefined;
  lines: InvoiceLinePayload[];
  vat_registered: boolean;
  vat_rate: number;
  invoice_prefix: string;
  is_quotation?: boolean | undefined;
}

export interface ConvertQuotationPayload {
  payment_method: string;
  paid_amount: number;
  vat_registered: boolean;
  vat_rate: number;
  invoice_prefix: string;
}

export const invoicesApi = {
  list(
    params: {
      branch_id?: string;
      customer_id?: string;
      fiscal_year_id?: string;
      status?: string;
      kind?: string;
      q?: string;
      bs_from?: string;
      bs_to?: string;
      page?: number;
      per_page?: number;
    } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.branch_id) qs.set("branch_id", params.branch_id);
    if (params.customer_id) qs.set("customer_id", params.customer_id);
    if (params.fiscal_year_id) qs.set("fiscal_year_id", params.fiscal_year_id);
    if (params.status) qs.set("status", params.status);
    if (params.kind) qs.set("kind", params.kind);
    if (params.q) qs.set("q", params.q);
    if (params.bs_from) qs.set("bs_from", params.bs_from);
    if (params.bs_to) qs.set("bs_to", params.bs_to);
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 25));
    return apiClient.get<InvoiceDto[]>(`/ims/invoices?${qs.toString()}`);
  },
  create(payload: CreateInvoicePayload) {
    return apiClient.post<InvoiceDto>("/ims/invoices", payload);
  },
  convert(invoiceId: string, payload: ConvertQuotationPayload) {
    return apiClient.post<InvoiceDto>(`/ims/invoices/${invoiceId}/convert`, payload);
  },
};
