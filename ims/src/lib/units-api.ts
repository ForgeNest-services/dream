import { apiClient } from "./api-client";

export interface UnitDto {
  id: string;
  tenant_id: string;
  name: string;
  symbol: string;
  allows_decimals: boolean;
  created_at: string;
  updated_at: string;
}

export const unitsApi = {
  list() {
    return apiClient.get<UnitDto[]>("/ims/units");
  },
};
