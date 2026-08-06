import { apiClient } from "./api-client";

export interface GuestsQuery {
  q?: string;
  docType?: string;
  nationality?: string;
  page?: number;
  perPage?: number;
}

function toQueryString(params: GuestsQuery): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.docType) qs.set("doc_type", params.docType);
  if (params.nationality) qs.set("nationality", params.nationality);
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export interface GuestDto {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_document_type: string | null;
  id_document_number: string | null;
  nationality: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGuestPayload {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  id_document_type?: string | null;
  id_document_number?: string | null;
  nationality?: string | null;
}

export interface UpdateGuestPayload extends Partial<CreateGuestPayload> {}

export const guestsApi = {
  list(params: GuestsQuery = {}) {
    return apiClient.get<GuestDto[]>(`/hotel-pms/guests${toQueryString(params)}`);
  },
  create(payload: CreateGuestPayload) {
    return apiClient.post<GuestDto>("/hotel-pms/guests", payload);
  },
  update(guestId: string, payload: UpdateGuestPayload) {
    return apiClient.patch<GuestDto>(`/hotel-pms/guests/${guestId}`, payload);
  },
  remove(guestId: string) {
    return apiClient.delete<{ deleted: boolean }>(`/hotel-pms/guests/${guestId}`);
  },
};
