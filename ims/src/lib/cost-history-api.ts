import { apiClient } from "./api-client";

export interface CostHistoryEntryDto {
  date: string;
  date_bs: string;
  unit_cost: number | string;
  qty: number | string;
  purchase_id: string;
  purchase_number: string;
  bill_no: string | null;
}

export const costHistoryApi = {
  forVariant(variantId: string) {
    return apiClient.get<CostHistoryEntryDto[]>(`/ims/variants/${variantId}/cost-history`);
  },
};
