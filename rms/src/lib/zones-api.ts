import { apiClient } from "./api-client";

export interface ZoneDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateZonePayload {
  name: string;
  display_order?: number;
}

export interface UpdateZonePayload {
  name?: string;
  display_order?: number;
}

export const zonesApi = {
  list(branchId: string) {
    return apiClient.get<ZoneDto[]>(`/restro/branches/${branchId}/zones`);
  },
  create(branchId: string, payload: CreateZonePayload) {
    return apiClient.post<ZoneDto>(`/restro/branches/${branchId}/zones`, payload);
  },
  update(branchId: string, zoneId: string, payload: UpdateZonePayload) {
    return apiClient.patch<ZoneDto>(
      `/restro/branches/${branchId}/zones/${zoneId}`,
      payload,
    );
  },
  remove(branchId: string, zoneId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/restro/branches/${branchId}/zones/${zoneId}`,
    );
  },
};
