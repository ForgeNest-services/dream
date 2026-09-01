import { apiClient } from "./api-client";
import type { ApiEnvelope } from "./api-client";

export type OrderType = "dine-in" | "delivery";
export type OrderStatus = "draft" | "paid" | "cancelled";
export type KitchenStatus = "new" | "cooking" | "ready" | "served";
export type DeliveryStatus = "pending" | "out" | "delivered";
export type PaymentMethod = "cash" | "qr" | "khata";
export type DiscountType = "percent" | "flat";

export interface OrderCustomerRefDto {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

export interface OrderLineDto {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  variant_name: string | null;
  price: string; // Decimal serialized as string
  qty: number;
  note: string | null;
  sent: boolean;
  is_voided: boolean;
  voided_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  table_id: string | null;
  customer_id: string | null;
  bill_number: number;
  type: OrderType;
  status: OrderStatus;
  kitchen_status: KitchenStatus;
  placed_at: string;
  // Bikram Sambat mirror of placed_at, stored server-side as "YYYY-MM-DD"
  // (BS). See api/utils/bikram_sambat.py.
  placed_at_bs: string;
  paid_at: string | null;
  paid_at_bs: string | null;
  // NULL until the khata order is paid down via /settle-khata. For cash/qr
  // orders this equals paid_at (settlement is instant).
  settled_at: string | null;
  settled_at_bs: string | null;
  discount_type: DiscountType;
  discount_value: string;
  // IRD: simplified ("abbreviated") vs full ("tax") VAT breakdown bill —
  // null until mark-paid. Display-only, see order_service.py's mark_paid.
  kind: "tax" | "abbreviated" | null;
  // ── VAT breakdown snapshot (IRD) — null until mark-paid. Prefer this over
  // recomputing from lines for a paid order: it's the actual amount the
  // customer was charged and must never change even if VAT settings later
  // do. Money fields are Decimal on the wire — strings, see asNum() below.
  subtotal_amount: string | null;
  taxable_amount: string | null;
  exempt_amount: string | null;
  vat_amount: string | null;
  total_amount: string | null;
  payment_method: PaymentMethod | null;
  // ── Seller/buyer snapshot (IRD) ──────────────────────────────────────
  seller_name: string | null;
  seller_address: string | null;
  seller_pan: string | null;
  buyer_name: string | null;
  buyer_pan: string | null;
  waiter_name: string;
  waiter_cred_id: string | null;
  delivery_status: DeliveryStatus | null;
  // ── Reprint / credit note (IRD) ──────────────────────────────────────
  print_count: number;
  is_reprint: boolean;
  reprint_of: string | null;
  reprint_number: number | null;
  is_credit_note: boolean;
  original_order_id: string | null;
  note_reason: string | null;
  cbms_synced: boolean;
  // Embedded (slim) customer object — populated whenever customer_id is set.
  // Delivery orders always have this; dine-in orders have it when the
  // waiter attached a customer at pay time (khata).
  customer: OrderCustomerRefDto | null;
  created_at: string;
  updated_at: string;
  lines: OrderLineDto[];
  // IRD: Electronic Billing Procedure 2082, clause 6.2घ — Order Slip
  // sequential numbers this bill was built from. Only populated by
  // GET /orders/{id} and send-to-kitchen responses — undefined elsewhere
  // (list/board views never fetch it, to avoid an N+1 query backend-side).
  slip_numbers?: number[];
}

export const asNum = (v: string | number | null | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0);

export interface OrdersListQuery {
  status?: OrderStatus;
  type?: OrderType;
  kitchen_status?: KitchenStatus;
  table_id?: string;
  limit?: number;
}

function toQuery(params: OrdersListQuery): string {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.kitchen_status) qs.set("kitchen_status", params.kitchen_status);
  if (params.table_id) qs.set("table_id", params.table_id);
  if (params.limit) qs.set("limit", String(params.limit));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// Paginated bills-history query — superset of OrdersListQuery. `bs_from`
// and `bs_to` accept BS dates in "YYYY-MM-DD" format (backend does a lexical
// comparison against the persisted `placed_at_bs` column).
export interface OrdersPaginatedQuery extends Omit<OrdersListQuery, "limit"> {
  q?: string;
  payment_method?: PaymentMethod;
  bs_from?: string;
  bs_to?: string;
  page?: number;
  per_page?: number;
}

function toPaginatedQuery(params: OrdersPaginatedQuery): string {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.kitchen_status) qs.set("kitchen_status", params.kitchen_status);
  if (params.table_id) qs.set("table_id", params.table_id);
  if (params.payment_method) qs.set("payment_method", params.payment_method);
  if (params.q) qs.set("q", params.q);
  if (params.bs_from) qs.set("bs_from", params.bs_from);
  if (params.bs_to) qs.set("bs_to", params.bs_to);
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export interface CreateOrderPayload {
  type: OrderType;
  table_id?: string;
  // Required for delivery. Optional for dine-in (attach a repeat customer
  // upfront, or leave off and attach at khata-pay time).
  customer_id?: string;
}

export interface AddOrderLinePayload {
  menu_item_id?: string | null;
  variant_name?: string | null;
  name?: string;
  price?: number;
  qty?: number;
  note?: string | null;
}

export interface UpdateOrderLinePayload {
  qty?: number;
  note?: string | null;
}

export const ordersApi = {
  list(branchId: string, params: OrdersListQuery = {}) {
    return apiClient.get<OrderDto[]>(
      `/restro/branches/${branchId}/orders${toQuery(params)}`,
    );
  },
  paginated(
    branchId: string,
    params: OrdersPaginatedQuery = {},
  ): Promise<ApiEnvelope<OrderDto[]>> {
    return apiClient.get<OrderDto[]>(
      `/restro/branches/${branchId}/orders/paginated${toPaginatedQuery(params)}`,
    );
  },
  get(branchId: string, orderId: string) {
    return apiClient.get<OrderDto>(`/restro/branches/${branchId}/orders/${orderId}`);
  },
  getDraftForTable(branchId: string, tableId: string) {
    return apiClient.get<OrderDto | null>(
      `/restro/branches/${branchId}/orders/by-table/${tableId}`,
    );
  },
  create(branchId: string, payload: CreateOrderPayload) {
    return apiClient.post<OrderDto>(`/restro/branches/${branchId}/orders`, payload);
  },
  addLine(branchId: string, orderId: string, payload: AddOrderLinePayload) {
    return apiClient.post<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/lines`,
      payload,
    );
  },
  updateLine(
    branchId: string,
    orderId: string,
    lineId: string,
    payload: UpdateOrderLinePayload,
  ) {
    return apiClient.patch<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/lines/${lineId}`,
      payload,
    );
  },
  voidLine(branchId: string, orderId: string, lineId: string, reason?: string) {
    return apiClient.post<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/lines/${lineId}/void`,
      { reason: reason ?? null },
    );
  },
  deleteLine(branchId: string, orderId: string, lineId: string) {
    return apiClient.delete<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/lines/${lineId}`,
    );
  },
  sendToKitchen(branchId: string, orderId: string) {
    return apiClient.post<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/send-to-kitchen`,
      {},
    );
  },
  setKitchenStatus(branchId: string, orderId: string, kitchen_status: KitchenStatus) {
    return apiClient.patch<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/kitchen-status`,
      { kitchen_status },
    );
  },
  setDiscount(
    branchId: string,
    orderId: string,
    discount_type: DiscountType,
    discount_value: number,
  ) {
    return apiClient.patch<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/discount`,
      { discount_type, discount_value },
    );
  },
  setCustomer(branchId: string, orderId: string, customer_id: string | null) {
    return apiClient.patch<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/customer`,
      { customer_id },
    );
  },
  markPaid(
    branchId: string,
    orderId: string,
    payment_method: PaymentMethod,
    customer_id?: string,
    buyer_pan?: string,
    show_vat_breakdown?: boolean,
  ) {
    return apiClient.post<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/mark-paid`,
      {
        payment_method,
        customer_id: customer_id ?? null,
        buyer_pan: buyer_pan?.trim() || null,
        show_vat_breakdown: show_vat_breakdown ?? null,
      },
    );
  },
  cancel(branchId: string, orderId: string) {
    return apiClient.post<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/cancel`,
      {},
    );
  },
  setDeliveryStatus(
    branchId: string,
    orderId: string,
    delivery_status: DeliveryStatus,
  ) {
    return apiClient.patch<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/delivery-status`,
      { delivery_status },
    );
  },
  // Call right before actually printing/showing a paid bill — server bumps
  // print_count and tells us whether to render the "COPY OF ORIGINAL"
  // watermark on this print.
  registerPrint(branchId: string, orderId: string) {
    return apiClient.post<{ is_reprint: boolean; print_count: number }>(
      `/restro/branches/${branchId}/orders/${orderId}/register-print`,
      {},
    );
  },
};
