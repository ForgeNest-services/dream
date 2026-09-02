import { apiClient } from "./api-client";

export interface CustomerDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  // Decimal-as-string: sum of unsettled khata order totals for this customer.
  outstanding_balance: string;
  created_at: string;
  updated_at: string;
}

export interface KhataOrderEntryDto {
  id: string;
  type: "dine-in" | "delivery";
  placed_at: string;
  placed_at_bs: string;
  total: string;
  line_count: number;
}

export interface KhataSettlementDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string;
  amount: string;
  method: "cash" | "qr";
  note: string | null;
  actor_name: string;
  actor_cred_id: string | null;
  created_at: string;
  created_at_bs: string;
}

export interface KhataHistoryDto {
  balance: string;
  debits_total: string;
  credits_total: string;
  orders: KhataOrderEntryDto[];
  settlements: KhataSettlementDto[];
}

// Full customer history — superset of KhataOrderEntryDto adding bill_number,
// status, and payment_method so a manager can see cash/qr/khata activity in
// one timeline.
export interface CustomerOrderEntryDto {
  id: string;
  bill_number: number;
  bill_code: string | null;
  type: "dine-in" | "delivery";
  status: "draft" | "paid" | "cancelled";
  payment_method: "cash" | "qr" | "khata" | null;
  placed_at: string;
  placed_at_bs: string;
  total: string;
  line_count: number;
}

export interface CustomerHistoryDto {
  total_orders: number;
  total_spent: string;
  outstanding_balance: string;
  orders: CustomerOrderEntryDto[];
}

export interface CreateKhataSettlementPayload {
  amount: number;
  method: "cash" | "qr";
  note?: string | null;
}

export interface CreateKhataSettlementResponse {
  settlement: KhataSettlementDto;
  new_balance: string;
  customer: CustomerDto;
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerPayload {
  name?: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
  clear_phone?: boolean;
  clear_address?: boolean;
  clear_notes?: boolean;
}

export const customersApi = {
  list(branchId: string, search?: string) {
    const qs = search ? `?q=${encodeURIComponent(search)}` : "";
    return apiClient.get<CustomerDto[]>(`/restro/branches/${branchId}/customers${qs}`);
  },
  create(branchId: string, payload: CreateCustomerPayload) {
    return apiClient.post<CustomerDto>(`/restro/branches/${branchId}/customers`, payload);
  },
  update(branchId: string, customerId: string, payload: UpdateCustomerPayload) {
    return apiClient.patch<CustomerDto>(
      `/restro/branches/${branchId}/customers/${customerId}`,
      payload,
    );
  },
  remove(branchId: string, customerId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/restro/branches/${branchId}/customers/${customerId}`,
    );
  },
  addKhataSettlement(
    branchId: string,
    customerId: string,
    payload: CreateKhataSettlementPayload,
  ) {
    return apiClient.post<CreateKhataSettlementResponse>(
      `/restro/branches/${branchId}/customers/${customerId}/khata-settlements`,
      payload,
    );
  },
  khataHistory(branchId: string, customerId: string) {
    return apiClient.get<KhataHistoryDto>(
      `/restro/branches/${branchId}/customers/${customerId}/khata-history`,
    );
  },
  // Superset of khataHistory — every attached order regardless of payment
  // method or status. Backs the customer-detail history view so a manager
  // can see the whole activity for a repeat customer (not just khata).
  history(branchId: string, customerId: string) {
    return apiClient.get<CustomerHistoryDto>(
      `/restro/branches/${branchId}/customers/${customerId}/history`,
    );
  },
};
