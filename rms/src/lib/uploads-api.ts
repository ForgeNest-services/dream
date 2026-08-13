import { apiClient } from "./api-client";

export const uploadsApi = {
  uploadMenuItemImage(branchId: string, file: File) {
    const form = new FormData();
    form.append("app", "restro");
    form.append("category", "menu-items");
    form.append("branch_id", branchId);
    form.append("file", file);
    return apiClient.upload<{ url: string }>("/uploads", form);
  },
};
