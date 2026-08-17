import { apiClient } from "./api-client";

// Public (unauthenticated) endpoints for the QR-menu page. Uses the same
// apiClient wrapper as everything else — the wrapper doesn't force an Auth
// header, so an unauthenticated call just doesn't send one. Money fields are
// serialized as strings on the wire (Decimal precision) — cast to Number for
// display.

export interface PublicMenuVariant {
  name: string;
  price: string;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  image_url: string | null;
  has_variants: boolean;
  price: string | null;
  sold_out: boolean;
  variants: PublicMenuVariant[];
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

export interface PublicMenuBranch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
}

export interface PublicMenuDto {
  branch: PublicMenuBranch;
  categories: PublicMenuCategory[];
}

export const publicMenuApi = {
  get(branchId: string) {
    return apiClient.get<PublicMenuDto>(
      `/restro/public/branches/${branchId}/menu`,
    );
  },
};
