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

export interface SettleKhataResponse {
  orders_settled: number;
  amount_settled: string;
  settlement_method: "cash" | "qr";
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
  settleKhata(branchId: string, customerId: string, settlement_method: "cash" | "qr") {
    return apiClient.post<SettleKhataResponse>(
      `/restro/branches/${branchId}/customers/${customerId}/settle-khata`,
      { settlement_method },
    );
  },
};
