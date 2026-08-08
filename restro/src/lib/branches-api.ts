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
    // Unified /branches endpoint. Staff tokens (from any app) return either
    // the staff's single scoped branch or all tenant branches for owner staff.
    return apiClient.get<BranchDto[]>("/branches");
  },
};
