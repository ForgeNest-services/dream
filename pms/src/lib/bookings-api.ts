import { apiClient } from "./api-client";
import type { RoomDto } from "./rooms-api";

export type BookingStatus =
  | "reserved"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export interface BookingDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  room_id: string;
  room: { id: string; room_number: string; floor: string | null } | null;
  guest_id: string;
  guest: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  check_in_date: string;
  check_out_date: string;
  actual_check_in: string | null;
  actual_check_out: string | null;
  status: BookingStatus;
  rate_per_night: string;
  num_guests: number;
  notes: string | null;
  created_by_cred_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingPayload {
  room_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  notes?: string | null;
  rate_per_night?: number | null;
}

export interface UpdateBookingPayload {
  room_id?: string;
  check_in_date?: string;
  check_out_date?: string;
  num_guests?: number;
  notes?: string | null;
  rate_per_night?: number | null;
}

export interface BookingsQuery {
  q?: string;
  status?: BookingStatus | "";
  room_id?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

function toQueryString(params: BookingsQuery): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.room_id) qs.set("room_id", params.room_id);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const bookingsApi = {
  list(branchId: string, params: BookingsQuery = {}) {
    return apiClient.get<BookingDto[]>(
      `/hotel-pms/branches/${branchId}/bookings${toQueryString(params)}`,
    );
  },
  availability(branchId: string, checkIn: string, checkOut: string) {
    const qs = new URLSearchParams({ check_in: checkIn, check_out: checkOut });
    return apiClient.get<RoomDto[]>(
      `/hotel-pms/branches/${branchId}/bookings/availability?${qs.toString()}`,
    );
  },
  create(branchId: string, payload: CreateBookingPayload) {
    return apiClient.post<BookingDto>(`/hotel-pms/branches/${branchId}/bookings`, payload);
  },
  update(branchId: string, bookingId: string, payload: UpdateBookingPayload) {
    return apiClient.patch<BookingDto>(
      `/hotel-pms/branches/${branchId}/bookings/${bookingId}`,
      payload,
    );
  },
  checkIn(branchId: string, bookingId: string) {
    return apiClient.post<BookingDto>(
      `/hotel-pms/branches/${branchId}/bookings/${bookingId}/check-in`,
      {},
    );
  },
  checkOut(branchId: string, bookingId: string) {
    return apiClient.post<BookingDto>(
      `/hotel-pms/branches/${branchId}/bookings/${bookingId}/check-out`,
      {},
    );
  },
  cancel(branchId: string, bookingId: string) {
    return apiClient.post<BookingDto>(
      `/hotel-pms/branches/${branchId}/bookings/${bookingId}/cancel`,
      {},
    );
  },
  noShow(branchId: string, bookingId: string) {
    return apiClient.post<BookingDto>(
      `/hotel-pms/branches/${branchId}/bookings/${bookingId}/no-show`,
      {},
    );
  },
};
