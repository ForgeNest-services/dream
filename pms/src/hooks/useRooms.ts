import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  roomsApi,
  type RoomDto,
  type CreateRoomPayload,
  type UpdateRoomPayload,
} from "@/lib/rooms-api";

export function useRooms(branchId: string | null | undefined) {
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const fetch = useCallback(async () => {
    if (!branchId) {
      setRooms([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await roomsApi.list(branchId);
      setRooms(response.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load rooms";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

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

  return { rooms, isLoading, isMutating, refetch: fetch, create, update, remove };
}
