import { apiClient } from "./api-client";

export interface VariantDto {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemComponentDto {
  id: string;
  child_menu_item_id: string;
  child_variant_name: string | null;
  qty: number;
  display_order: number;
  // Server-populated from the joined child row so the UI can render
  // "2× Steam Momo (Chicken)" without a lookup.
  child_name: string;
}

export interface MenuItemDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  category_id: string;
  name: string;
  image_url: string | null;
  has_variants: boolean;
  is_combo: boolean;
  price: number | null;
  sold_out: boolean;
  is_active: boolean;
  variants: VariantDto[];
  components: MenuItemComponentDto[];
  created_at: string;
  updated_at: string;
}

export interface VariantInput {
  name: string;
  price: number;
}

export interface MenuItemComponentInput {
  child_menu_item_id: string;
  child_variant_name?: string | null;
  qty: number;
}

export interface CreateMenuItemPayload {
  category_id: string;
  name: string;
  has_variants: boolean;
  is_combo?: boolean;
  price?: number | null;
  image_url?: string | null;
  variants?: VariantInput[];
  components?: MenuItemComponentInput[];
}

export interface UpdateMenuItemPayload {
  category_id?: string;
  name?: string;
  has_variants?: boolean;
  is_combo?: boolean;
  price?: number | null;
  clear_price?: boolean;
  image_url?: string | null;
  variants?: VariantInput[];
  components?: MenuItemComponentInput[];
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
