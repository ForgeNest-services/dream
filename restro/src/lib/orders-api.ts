import { apiClient } from "./api-client";
import type { ApiEnvelope } from "./api-client";

export type OrderType = "dine-in" | "delivery";
export type OrderStatus = "draft" | "paid" | "cancelled";
export type KitchenStatus = "new" | "cooking" | "ready" | "served";
export type DeliveryStatus = "pending" | "out" | "delivered";
export type PaymentMethod = "cash" | "qr" | "card";
export type DiscountType = "percent" | "flat";

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
  type: OrderType;
  status: OrderStatus;
  kitchen_status: KitchenStatus;
  placed_at: string;
  // Bikram Sambat mirror of placed_at, stored server-side as "YYYY-MM-DD"
  // (BS). See api/utils/bikram_sambat.py.
  placed_at_bs: string;
  paid_at: string | null;
  paid_at_bs: string | null;
  discount_type: DiscountType;
  discount_value: string;
  payment_method: PaymentMethod | null;
  waiter_name: string;
  waiter_cred_id: string | null;
  delivery_customer_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  delivery_status: DeliveryStatus | null;
  created_at: string;
  updated_at: string;
  lines: OrderLineDto[];
}

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
  delivery_customer_name?: string;
  delivery_phone?: string;
  delivery_address?: string;
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
  markPaid(branchId: string, orderId: string, payment_method: PaymentMethod) {
    return apiClient.post<OrderDto>(
      `/restro/branches/${branchId}/orders/${orderId}/mark-paid`,
      { payment_method },
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
};
