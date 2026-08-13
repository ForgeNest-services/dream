import { apiClient } from "./api-client";

export type TableStatus = "empty" | "occupied" | "reserved";

export interface TableDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  zone_id: string;
  label: string;
  status: TableStatus;
  merge_id: string | null;
  reservation_guest_name: string | null;
  reservation_phone: string | null;
  reservation_date: string | null; // "YYYY-MM-DD"
  reservation_time: string | null; // "HH:MM"
  reservation_party_size: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTablePayload {
  zone_id: string;
  label: string;
}

export interface UpdateTablePayload {
  label?: string;
  zone_id?: string;
  status?: TableStatus;
}

export interface ReserveTablePayload {
  guest_name: string;
  phone?: string | null;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  party_size: number;
}

export const tablesApi = {
  list(branchId: string, zoneId?: string) {
    const qs = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : "";
    return apiClient.get<TableDto[]>(`/restro/branches/${branchId}/tables${qs}`);
  },
  create(branchId: string, payload: CreateTablePayload) {
    return apiClient.post<TableDto>(`/restro/branches/${branchId}/tables`, payload);
  },
  update(branchId: string, tableId: string, payload: UpdateTablePayload) {
    return apiClient.patch<TableDto>(
      `/restro/branches/${branchId}/tables/${tableId}`,
      payload,
    );
  },
  remove(branchId: string, tableId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/restro/branches/${branchId}/tables/${tableId}`,
    );
  },
  reserve(branchId: string, tableId: string, payload: ReserveTablePayload) {
    return apiClient.post<TableDto>(
      `/restro/branches/${branchId}/tables/${tableId}/reserve`,
      payload,
    );
  },
  clearReservation(branchId: string, tableId: string) {
    return apiClient.delete<TableDto>(
      `/restro/branches/${branchId}/tables/${tableId}/reservation`,
    );
  },
  merge(branchId: string, tableIds: string[]) {
    return apiClient.post<TableDto[]>(`/restro/branches/${branchId}/tables/merge`, {
      table_ids: tableIds,
    });
  },
  unmerge(branchId: string, tableId: string) {
    return apiClient.post<TableDto[]>(
      `/restro/branches/${branchId}/tables/${tableId}/unmerge`,
      {},
    );
  },
};
