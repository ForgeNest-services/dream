import { apiClient } from "./api-client";

export interface ExpenseDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  category: string;
  amount: string; // Decimal serialized as string
  note: string | null;
  spent_at_bs: string;
  actor_name: string;
  actor_cred_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExpensePayload {
  category?: string;
  amount: number;
  note?: string | null;
  spent_at_bs: string;
}

export interface UpdateExpensePayload {
  category?: string;
  amount?: number;
  note?: string | null;
  spent_at_bs?: string;
  clear_note?: boolean;
}

export const expensesApi = {
  list(branchId: string, params: { bs_from?: string; bs_to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.bs_from) qs.set("bs_from", params.bs_from);
    if (params.bs_to) qs.set("bs_to", params.bs_to);
    const s = qs.toString();
    return apiClient.get<ExpenseDto[]>(
      `/restro/branches/${branchId}/expenses${s ? `?${s}` : ""}`,
    );
  },
  create(branchId: string, payload: CreateExpensePayload) {
    return apiClient.post<ExpenseDto>(`/restro/branches/${branchId}/expenses`, payload);
  },
  update(branchId: string, expenseId: string, payload: UpdateExpensePayload) {
    return apiClient.patch<ExpenseDto>(
      `/restro/branches/${branchId}/expenses/${expenseId}`,
      payload,
    );
  },
  remove(branchId: string, expenseId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/restro/branches/${branchId}/expenses/${expenseId}`,
    );
  },
};
