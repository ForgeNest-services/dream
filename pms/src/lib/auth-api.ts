import { apiClient } from "./api-client";

export interface LoginResponse {
  token: string;
  role: string;
  tenant_id: string;
  branch_id: string | null;
  expires_at: string;
}

export const authApi = {
  login(username: string, password: string) {
    return apiClient.post<LoginResponse>("/hotel-pms/auth/login", {
      username,
      password,
    });
  },
};
