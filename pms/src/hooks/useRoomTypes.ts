import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  roomTypesApi,
  type RoomTypeDto,
  type CreateRoomTypePayload,
  type UpdateRoomTypePayload,
} from "@/lib/room-types-api";

export function useRoomTypes(branchId: string | null | undefined) {
  const [roomTypes, setRoomTypes] = useState<RoomTypeDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const fetch = useCallback(async () => {
    if (!branchId) {
      setRoomTypes([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await roomTypesApi.list(branchId);
      setRoomTypes(response.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load room types";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = async (payload: CreateRoomTypePayload): Promise<RoomTypeDto | null> => {
    if (!branchId) return null;
    setIsMutating(true);
    try {
      const response = await roomTypesApi.create(branchId, payload);
      const created = response.data ?? null;
      if (created) {
        toast.success("Room type created");
        await fetch();
      }
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create room type";
      toast.error(message);
      return null;
    } finally {
      setIsMutating(false);
    }
  };

  const update = async (roomTypeId: string, payload: UpdateRoomTypePayload): Promise<boolean> => {
    if (!branchId) return false;
    setIsMutating(true);
    try {
      await roomTypesApi.update(branchId, roomTypeId, payload);
      toast.success("Room type updated");
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update room type";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const remove = async (roomTypeId: string): Promise<boolean> => {
    if (!branchId) return false;
    setIsMutating(true);
    try {
      await roomTypesApi.remove(branchId, roomTypeId);
      toast.success("Room type removed");
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove room type";
      toast.error(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  return { roomTypes, isLoading, isMutating, refetch: fetch, create, update, remove };
}
