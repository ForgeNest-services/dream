import { apiClient } from "./api-client";

export interface BranchDto {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const branchesApi = {
  listMine() {
    return apiClient.get<BranchDto[]>("/hotel-pms/branches/me");
  },
};
