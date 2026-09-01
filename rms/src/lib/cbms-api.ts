import { apiClient } from "./api-client";

export const cbmsApi = {
  payload(branchId: string, orderId: string) {
    return apiClient.get<Record<string, unknown>>(
      `/restro/branches/${branchId}/orders/${orderId}/cbms-payload`,
    );
  },
  sync(branchId: string, orderId: string) {
    return apiClient.post<{ synced: boolean; message: string }>(
      `/restro/branches/${branchId}/orders/${orderId}/cbms-sync`,
      {},
    );
  },
  getCredentials() {
    return apiClient.get<{ configured: boolean; ird_username?: string }>(
      `/restro/cbms-credentials`,
    );
  },
  saveCredentials(username: string, password: string) {
    return apiClient.put<{ saved: boolean }>(`/restro/cbms-credentials`, {
      ird_username: username,
      ird_password: password,
    });
  },
};
