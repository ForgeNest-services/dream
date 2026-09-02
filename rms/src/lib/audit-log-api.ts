import { apiClient } from "./api-client";

// IRD: Electronic Billing Procedure 2082, clause 6.3ग — the User Activity
// Log must be viewable/filterable from the front-end.
export interface AuditLogEntryDto {
  id: string;
  app_code: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by: string;
  performer_type: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  terminal_ip: string | null;
  created_at: string;
}

export interface AuditLogQuery {
  entity_type?: string;
  action?: string;
  performed_by?: string;
  q?: string;
  page?: number;
  per_page?: number;
}

export const auditLogApi = {
  list(params: AuditLogQuery = {}) {
    const qs = new URLSearchParams();
    if (params.entity_type) qs.set("entity_type", params.entity_type);
    if (params.action) qs.set("action", params.action);
    if (params.performed_by) qs.set("performed_by", params.performed_by);
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.per_page) qs.set("per_page", String(params.per_page));
    const s = qs.toString();
    return apiClient.get<AuditLogEntryDto[]>(`/restro/audit-log${s ? `?${s}` : ""}`);
  },
};
