import { apiClient } from "./api-client";

// One-shot uploads that don't belong in the reusable Media Center library
// (see media-api.ts's docstring) — a payment QR is per-branch config, not
// a product asset meant to be browsed/reused. Hits the generic /uploads
// endpoint shared across apps (see api/features/uploads/router.py) instead
// of POST /ims/media, so it never shows up in the product image picker.
export const uploadsApi = {
  uploadPaymentQr(branchId: string, file: File) {
    const form = new FormData();
    form.append("app", "ims");
    form.append("category", "payment-qr");
    form.append("branch_id", branchId);
    form.append("file", file);
    return apiClient.upload<{ url: string }>("/uploads", form);
  },
};
