import { apiClient } from "./api-client";

export interface CategoryDto {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export const categoriesApi = {
  list() {
    return apiClient.get<CategoryDto[]>("/ims/categories");
  },
  create(name: string, parentId: string | null) {
    return apiClient.post<CategoryDto>("/ims/categories", { name, parent_id: parentId });
  },
  rename(id: string, name: string) {
    return apiClient.patch<CategoryDto>(`/ims/categories/${id}`, { name });
  },
  delete(id: string) {
    return apiClient.delete<{ deleted: boolean }>(`/ims/categories/${id}`);
  },
};
