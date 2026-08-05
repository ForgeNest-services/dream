import { apiClient } from "./api-client";

export type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance";

export interface RoomDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  room_type_id: string;
  room_type: { id: string; name: string } | null;
  room_number: string;
  floor: string | null;
  status: RoomStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomPayload {
  room_type_id: string;
  room_number: string;
  floor?: string | null;
  status?: RoomStatus;
}

export interface UpdateRoomPayload {
  room_type_id?: string;
  room_number?: string;
  floor?: string | null;
  status?: RoomStatus;
}

export const roomsApi = {
  list(branchId: string) {
    return apiClient.get<RoomDto[]>(`/hotel-pms/branches/${branchId}/rooms`);
  },
  create(branchId: string, payload: CreateRoomPayload) {
    return apiClient.post<RoomDto>(`/hotel-pms/branches/${branchId}/rooms`, payload);
  },
  update(branchId: string, roomId: string, payload: UpdateRoomPayload) {
    return apiClient.patch<RoomDto>(`/hotel-pms/branches/${branchId}/rooms/${roomId}`, payload);
  },
  remove(branchId: string, roomId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/hotel-pms/branches/${branchId}/rooms/${roomId}`,
    );
  },
};
