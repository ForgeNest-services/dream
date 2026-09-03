import { apiClient } from "./api-client";

export interface BranchSettingsDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  vat_enabled: boolean;
  vat_rate: string; // Decimal serialized as string
  qr_image_url: string | null;
  cbms_realtime_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateBranchSettingsPayload {
  vat_enabled?: boolean;
  vat_rate?: number;
  qr_image_url?: string | null;
  clear_qr?: boolean;
  cbms_realtime_enabled?: boolean;
}

export const branchSettingsApi = {
  get(branchId: string) {
    return apiClient.get<BranchSettingsDto>(`/restro/branches/${branchId}/settings`);
  },
  update(branchId: string, payload: UpdateBranchSettingsPayload) {
    return apiClient.patch<BranchSettingsDto>(
      `/restro/branches/${branchId}/settings`,
      payload,
    );
  },
  clearQr(branchId: string) {
    return apiClient.delete<BranchSettingsDto>(
      `/restro/branches/${branchId}/settings/qr`,
    );
  },
};
