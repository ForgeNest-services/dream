import { apiClient } from "./api-client";

export interface BrandDto {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const brandsApi = {
  list() {
    return apiClient.get<BrandDto[]>("/ims/brands");
  },
  create(name: string) {
    return apiClient.post<BrandDto>("/ims/brands", { name });
  },
};
