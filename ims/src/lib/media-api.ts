import { apiClient } from "./api-client";
import { authStorage } from "./auth-storage";

export interface MediaDto {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  folder: string;
  size_kb: number;
  uploaded_at: string;
}

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "https://api.srotaapps.com/api";

export const mediaApi = {
  list(q?: string) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return apiClient.get<MediaDto[]>(`/ims/media${qs}`);
  },
  delete(mediaId: string) {
    return apiClient.delete<{ deleted: boolean }>(`/ims/media/${mediaId}`);
  },
  async upload(file: File, folder: string) {
    const form = new FormData();
    form.append("folder", folder);
    form.append("file", file);
    const token = authStorage.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/ims/media`, { method: "POST", body: form, headers });
    const payload = (await res.json()) as {
      success: boolean;
      data?: MediaDto;
      error?: { code: string; message: string };
    };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error?.message ?? "Upload failed");
    }
    return payload.data!;
  },
};
