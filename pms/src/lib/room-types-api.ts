import { apiClient } from "./api-client";

export interface RoomTypeDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  base_rate: string;
  capacity: number;
  count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomTypePayload {
  name: string;
  base_rate: number;
  capacity: number;
  count: number;
}

export interface UpdateRoomTypePayload {
  name?: string;
  base_rate?: number;
  capacity?: number;
  count?: number;
}

export const roomTypesApi = {
  list(branchId: string) {
    return apiClient.get<RoomTypeDto[]>(`/hotel-pms/branches/${branchId}/room-types`);
  },
  create(branchId: string, payload: CreateRoomTypePayload) {
    return apiClient.post<RoomTypeDto>(`/hotel-pms/branches/${branchId}/room-types`, payload);
  },
  update(branchId: string, roomTypeId: string, payload: UpdateRoomTypePayload) {
    return apiClient.patch<RoomTypeDto>(
      `/hotel-pms/branches/${branchId}/room-types/${roomTypeId}`,
      payload,
    );
  },
  remove(branchId: string, roomTypeId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/hotel-pms/branches/${branchId}/room-types/${roomTypeId}`,
    );
  },
};
