import { apiClient } from "./api-client";

export interface InventoryItemDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  category: string;
  unit: string;
  stock: string; // Decimal serializes as string
  threshold: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovementDto {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  type: "restock" | "adjust";
  delta: string;
  reason: string;
  note: string | null;
  cost: string | null;
  actor_name: string;
  actor_cred_id: string | null;
  created_at: string;
}

export interface CreateInventoryItemPayload {
  name: string;
  category?: string;
  unit?: string;
  threshold?: number;
  stock?: number;
}

export interface UpdateInventoryItemPayload {
  name?: string;
  category?: string;
  unit?: string;
  threshold?: number;
}

export interface RestockPayload {
  qty: number;
  cost?: number | null;
  note?: string | null;
}

export interface AdjustPayload {
  delta: number;
  reason: string;
  note?: string | null;
}

interface MutationResponse {
  item: InventoryItemDto;
  movement: StockMovementDto;
}

export const inventoryApi = {
  list(branchId: string) {
    return apiClient.get<InventoryItemDto[]>(`/restro/branches/${branchId}/inventory`);
  },
  create(branchId: string, payload: CreateInventoryItemPayload) {
    return apiClient.post<InventoryItemDto>(`/restro/branches/${branchId}/inventory`, payload);
  },
  update(branchId: string, itemId: string, payload: UpdateInventoryItemPayload) {
    return apiClient.patch<InventoryItemDto>(
      `/restro/branches/${branchId}/inventory/${itemId}`,
      payload,
    );
  },
  remove(branchId: string, itemId: string) {
    return apiClient.delete<{ deleted: boolean }>(
      `/restro/branches/${branchId}/inventory/${itemId}`,
    );
  },
  restock(branchId: string, itemId: string, payload: RestockPayload) {
    return apiClient.post<MutationResponse>(
      `/restro/branches/${branchId}/inventory/${itemId}/restock`,
      payload,
    );
  },
  adjust(branchId: string, itemId: string, payload: AdjustPayload) {
    return apiClient.post<MutationResponse>(
      `/restro/branches/${branchId}/inventory/${itemId}/adjust`,
      payload,
    );
  },
  movements(branchId: string, itemId: string) {
    return apiClient.get<StockMovementDto[]>(
      `/restro/branches/${branchId}/inventory/${itemId}/movements`,
    );
  },
};
