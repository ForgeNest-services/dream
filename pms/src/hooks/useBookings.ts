import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  bookingsApi,
  type BookingDto,
  type BookingsQuery,
  type CreateBookingPayload,
  type UpdateBookingPayload,
} from "@/lib/bookings-api";
import type { PageMeta } from "@/lib/api-client";
import type { RoomDto } from "@/lib/rooms-api";

export function useBookings(
  branchId: string | null | undefined,
  options: BookingsQuery = {},
) {
  const { q, status, room_id, from, to, page, perPage } = options;

  const params = useMemo<BookingsQuery>(
    () => ({ q, status, room_id, from, to, page, perPage }),
    [q, status, room_id, from, to, page, perPage],
  );

  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const fetch = useCallback(async () => {
    if (!branchId) {
      setBookings([]);
      setMeta(null);
      return;
    }
    setIsLoading(true);
    try {
      const response = await bookingsApi.list(branchId, params);
      setBookings(response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load bookings";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = async (payload: CreateBookingPayload): Promise<BookingDto | null> => {
    if (!branchId) return null;
    setIsMutating(true);
    try {
      const response = await bookingsApi.create(branchId, payload);
      const created = response.data ?? null;
      if (created) {
        toast.success("Booking created");
        await fetch();
      }
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create booking";
      toast.error(message);
      return null;
    } finally {
      setIsMutating(false);
    }
  };

  const update = async (
    bookingId: string,
    payload: UpdateBookingPayload,
  ): Promise<boolean> => {
    if (!branchId) return false;
    setIsMutating(true);
    try {
      await bookingsApi.update(branchId, bookingId, payload);
      toast.success("Booking updated");
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update booking";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const transition = async (
    bookingId: string,
    action: "checkIn" | "checkOut" | "cancel" | "noShow",
    successMessage: string,
  ): Promise<boolean> => {
    if (!branchId) return false;
    setIsMutating(true);
    try {
      await bookingsApi[action](branchId, bookingId);
      toast.success(successMessage);
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const checkIn = (id: string) => transition(id, "checkIn", "Guest checked in");
  const checkOut = (id: string) => transition(id, "checkOut", "Guest checked out");
  const cancel = (id: string) => transition(id, "cancel", "Booking cancelled");
  const noShow = (id: string) => transition(id, "noShow", "Marked as no-show");

  const fetchAvailability = async (
    checkIn: string,
    checkOut: string,
  ): Promise<RoomDto[]> => {
    if (!branchId) return [];
    try {
      const response = await bookingsApi.availability(branchId, checkIn, checkOut);
      return response.data ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load available rooms";
      toast.error(message);
      return [];
    }
  };

  return {
    bookings,
    meta,
    isLoading,
    isMutating,
    refetch: fetch,
    create,
    update,
    checkIn,
    checkOut,
    cancel,
    noShow,
    fetchAvailability,
  };
}
