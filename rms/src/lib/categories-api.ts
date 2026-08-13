import { apiClient } from "./api-client";

export interface CategoryDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryPayload {
  name: string;
  display_order?: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  display_order?: number;
}

export const categoriesApi = {
  list(branchId: string) {
    return apiClient.get<CategoryDto[]>(`/restro/branches/${branchId}/categories`);
  },
  create(branchId: string, payload: CreateCategoryPayload) {
    return apiClient.post<CategoryDto>(`/restro/branches/${branchId}/categories`, payload);
  },
  update(branchId: string, categoryId: string, payload: UpdateCategoryPayload) {
    return apiClient.patch<CategoryDto>(
      `/restro/branches/${branchId}/categories/${categoryId}`,
      payload,
    );
  },
  remove(branchId: string, categoryId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/restro/branches/${branchId}/categories/${categoryId}`,
    );
  },
};
