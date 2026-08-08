import { apiClient } from "./api-client";

export interface VariantDto {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  category_id: string;
  name: string;
  image_url: string | null;
  has_variants: boolean;
  price: number | null;
  sold_out: boolean;
  is_active: boolean;
  variants: VariantDto[];
  created_at: string;
  updated_at: string;
}

export interface VariantInput {
  name: string;
  price: number;
}

export interface CreateMenuItemPayload {
  category_id: string;
  name: string;
  has_variants: boolean;
  price?: number | null;
  image_url?: string | null;
  variants?: VariantInput[];
}

export interface UpdateMenuItemPayload {
  category_id?: string;
  name?: string;
  has_variants?: boolean;
  price?: number | null;
  clear_price?: boolean;
  image_url?: string | null;
  variants?: VariantInput[];
}

export const menuItemsApi = {
  list(branchId: string, categoryId?: string) {
    const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : "";
    return apiClient.get<MenuItemDto[]>(`/restro/branches/${branchId}/menu-items${query}`);
  },
  create(branchId: string, payload: CreateMenuItemPayload) {
    return apiClient.post<MenuItemDto>(`/restro/branches/${branchId}/menu-items`, payload);
  },
  update(branchId: string, itemId: string, payload: UpdateMenuItemPayload) {
    return apiClient.patch<MenuItemDto>(
      `/restro/branches/${branchId}/menu-items/${itemId}`,
      payload,
    );
  },
  setSoldOut(branchId: string, itemId: string, soldOut: boolean) {
    return apiClient.patch<MenuItemDto>(
      `/restro/branches/${branchId}/menu-items/${itemId}/sold-out`,
      { sold_out: soldOut },
    );
  },
  remove(branchId: string, itemId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/restro/branches/${branchId}/menu-items/${itemId}`,
    );
  },
};
