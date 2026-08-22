import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { stockApi, type StockMovementDto } from "@/lib/stock-api";
import type { PageMeta } from "@/lib/api-client";

export interface MovementsQuery {
  branch_id?: string;
  variant_id?: string;
  type?: string;
  q?: string;
  bs_from?: string;
  bs_to?: string;
  page?: number;
  per_page?: number;
}

export function useMovements(options: MovementsQuery = {}) {
  const { branch_id, variant_id, type, q, bs_from, bs_to, page, per_page } = options;

  const params = useMemo<MovementsQuery>(
    () => ({ branch_id, variant_id, type, q, bs_from, bs_to, page, per_page }),
    [branch_id, variant_id, type, q, bs_from, bs_to, page, per_page],
  );

  const [movements, setMovements] = useState<StockMovementDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await stockApi.movements(params);
      setMovements(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load stock movements";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { movements, meta, isLoading, refetch: fetch };
}
