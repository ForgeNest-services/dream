import { apiClient } from "./api-client";

export interface CbmsSyncLogEntry {
  id: string;
  document_type: "invoice" | "credit_note";
  document_id: string;
  document_number: string | null;
  status: "pending" | "synced" | "failed";
  cbms_response_code: string | null;
  attempt_count: number;
  last_attempted_at: string | null;
  synced_at: string | null;
}

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
  // Credentials/sync-enabled are managed once from the shared admin app
  // (app.dream.com → Settings) — see that app's tax-settings page. RMS only
  // exposes its own sync history + retry below.
  syncLog(params: { status?: string; page?: number; per_page?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.per_page) qs.set("per_page", String(params.per_page));
    const s = qs.toString();
    return apiClient.get<CbmsSyncLogEntry[]>(`/restro/cbms-sync-log${s ? `?${s}` : ""}`);
  },
  resync(logId: string) {
    return apiClient.post<{ status: string }>(`/restro/cbms-sync-log/${logId}/resync`, {});
  },
};
