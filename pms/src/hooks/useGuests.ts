import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  guestsApi,
  type GuestDto,
  type CreateGuestPayload,
  type UpdateGuestPayload,
} from "@/lib/guests-api";

export function useGuests(enabled: boolean = true) {
  const [guests, setGuests] = useState<GuestDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const fetch = useCallback(async () => {
    if (!enabled) {
      setGuests([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await guestsApi.list();
      setGuests(response.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load guests";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = async (payload: CreateGuestPayload): Promise<GuestDto | null> => {
    setIsMutating(true);
    try {
      const response = await guestsApi.create(payload);
      const created = response.data ?? null;
      if (created) {
        toast.success(`Guest "${created.full_name}" added`);
        await fetch();
      }
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create guest";
      toast.error(message);
      return null;
    } finally {
      setIsMutating(false);
    }
  };

  const update = async (guestId: string, payload: UpdateGuestPayload): Promise<boolean> => {
    setIsMutating(true);
    try {
      await guestsApi.update(guestId, payload);
      toast.success("Guest updated");
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update guest";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const remove = async (guestId: string): Promise<boolean> => {
    setIsMutating(true);
    try {
      await guestsApi.remove(guestId);
      toast.success("Guest removed");
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove guest";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  return { guests, isLoading, isMutating, refetch: fetch, create, update, remove };
}
