import { apiClient } from "./api-client";

export interface LoginResponse {
  token: string;
  role: string;
  name: string;
  tenant_id: string;
  branch_id: string | null;
  expires_at: string;
}

export const authApi = {
  login(username: string, password: string) {
    return apiClient.post<LoginResponse>("/restro/auth/login", {
      username,
      password,
    });
  },
  // IRD: Electronic Billing Procedure 2082, clause 6.3ख — records the
  // logout event server-side for the activity log. There's no session to
  // actually invalidate (stateless JWT), so this is fire-and-forget from
  // the caller's perspective.
  logout() {
    return apiClient.post<void>("/restro/auth/logout", {});
  },
};
