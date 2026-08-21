import { apiClient } from "./api-client";

export interface FiscalYearDto {
  id: string;
  tenant_id: string;
  start_year: number;
  is_active: boolean;
  created_at: string;
}

export const fiscalYearsApi = {
  list() {
    return apiClient.get<FiscalYearDto[]>("/ims/fiscal-years");
  },
  create(startYear: number) {
    return apiClient.post<FiscalYearDto>("/ims/fiscal-years", { start_year: startYear });
  },
  activate(id: string) {
    return apiClient.post<FiscalYearDto>(`/ims/fiscal-years/${id}/activate`, {});
  },
  remove(id: string) {
    return apiClient.delete<{ deleted: boolean }>(`/ims/fiscal-years/${id}`);
  },
};
