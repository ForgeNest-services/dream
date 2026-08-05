import { apiClient } from "./api-client";

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
  list() {
    return apiClient.get<GuestDto[]>("/hotel-pms/guests");
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
