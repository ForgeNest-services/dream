import { apiClient } from "./api-client";

function uploadForCategory(branchId: string, category: string, file: File) {
  const form = new FormData();
  form.append("app", "restro");
  form.append("category", category);
  form.append("branch_id", branchId);
  form.append("file", file);
  return apiClient.upload<{ url: string }>("/uploads", form);
}

export const uploadsApi = {
  uploadMenuItemImage(branchId: string, file: File) {
    return uploadForCategory(branchId, "menu-items", file);
  },
  uploadPaymentQr(branchId: string, file: File) {
    return uploadForCategory(branchId, "payment-qr", file);
  },
};
