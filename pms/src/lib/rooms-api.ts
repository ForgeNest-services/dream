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
  rate_override: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomPayload {
  room_type_id: string;
  room_number: string;
  floor?: string | null;
  status?: RoomStatus;
  rate_override?: number | null;
}

export interface UpdateRoomPayload {
  room_type_id?: string;
  room_number?: string;
  floor?: string | null;
  status?: RoomStatus;
  rate_override?: number | null;
}

export interface RoomsQuery {
  q?: string;
  type?: string;
  status?: RoomStatus | "";
  page?: number;
  perPage?: number;
}

function toQueryString(params: RoomsQuery): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.type) qs.set("type", params.type);
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const roomsApi = {
  list(branchId: string, params: RoomsQuery = {}) {
    return apiClient.get<RoomDto[]>(
      `/hotel-pms/branches/${branchId}/rooms${toQueryString(params)}`,
    );
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
