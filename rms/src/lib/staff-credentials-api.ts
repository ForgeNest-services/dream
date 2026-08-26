import { apiClient } from "./api-client";

export interface StaffCredentialDto {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  role: string;
  username: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffCredentialPayload {
  role: string;
  username: string;
  password: string;
  branch_id?: string | null;
}

export interface UpdateStaffCredentialPayload {
  username?: string;
  password?: string;
}

// Owner-only (see require_restro_staff("owner") on the backend). Lets the
// Owner manage Manager/Waiter/Chef logins from inside Zestro's own Settings
// screen instead of the admin app.
export const staffCredentialsApi = {
  list() {
    return apiClient.get<StaffCredentialDto[]>("/restro/staff/credentials");
  },
  create(payload: CreateStaffCredentialPayload) {
    return apiClient.post<StaffCredentialDto>("/restro/staff/credentials", payload);
  },
  update(credId: string, payload: UpdateStaffCredentialPayload) {
    return apiClient.patch<StaffCredentialDto>(`/restro/staff/credentials/${credId}`, payload);
  },
  remove(credId: string) {
    return apiClient.delete<{ deleted: boolean }>(`/restro/staff/credentials/${credId}`);
  },
};
