import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  roomsApi,
  type RoomDto,
  type RoomsQuery,
  type CreateRoomPayload,
  type UpdateRoomPayload,
} from "@/lib/rooms-api";
import type { PageMeta } from "@/lib/api-client";

export function useRooms(
  branchId: string | null | undefined,
  options: RoomsQuery = {},
) {
  const { q, type, status, page, perPage } = options;

  const params = useMemo<RoomsQuery>(
    () => ({ q, type, status, page, perPage }),
    [q, type, status, page, perPage],
  );

  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const fetch = useCallback(async () => {
    if (!branchId) {
      setRooms([]);
      setMeta(null);
      return;
    }
    setIsLoading(true);
    try {
      const response = await roomsApi.list(branchId, params);
      setRooms(response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load rooms";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = async (payload: CreateRoomPayload): Promise<boolean> => {
    if (!branchId) return false;
    setIsMutating(true);
    try {
      await roomsApi.create(branchId, payload);
      toast.success(`Room ${payload.room_number} added`);
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create room";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const update = async (roomId: string, payload: UpdateRoomPayload): Promise<boolean> => {
    if (!branchId) return false;
    setIsMutating(true);
    try {
      await roomsApi.update(branchId, roomId, payload);
      toast.success("Room updated");
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update room";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const remove = async (roomId: string): Promise<boolean> => {
    if (!branchId) return false;
    setIsMutating(true);
    try {
      await roomsApi.remove(branchId, roomId);
      toast.success("Room removed");
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove room";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  return { rooms, meta, isLoading, isMutating, refetch: fetch, create, update, remove };
}
