import { apiClient } from "./api-client";

// vat_rate is Decimal on the backend — serialized as a JSON string. Call
// Number() before arithmetic (see app-store.tsx's num()).
export interface BranchSettingsDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  vat_enabled: boolean;
  vat_rate: number | string;
  created_at: string;
  updated_at: string;
}

export const branchSettingsApi = {
  get(branchId: string) {
    return apiClient.get<BranchSettingsDto>(`/ims/branches/${branchId}/settings`);
  },
  update(branchId: string, payload: { vat_enabled?: boolean; vat_rate?: number }) {
    return apiClient.patch<BranchSettingsDto>(`/ims/branches/${branchId}/settings`, payload);
  },
};
