import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { purchasesApi, type PurchaseDto } from "@/lib/purchases-api";
import type { PageMeta } from "@/lib/api-client";

export interface PurchasesQuery {
  branch_id?: string;
  party_id?: string;
  q?: string;
  bs_from?: string;
  bs_to?: string;
  page?: number;
  per_page?: number;
}

export function usePurchases(options: PurchasesQuery = {}) {
  const { branch_id, party_id, q, bs_from, bs_to, page, per_page } = options;

  const params = useMemo<PurchasesQuery>(
    () => ({ branch_id, party_id, q, bs_from, bs_to, page, per_page }),
    [branch_id, party_id, q, bs_from, bs_to, page, per_page],
  );

  const [purchases, setPurchases] = useState<PurchaseDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await purchasesApi.list(params);
      setPurchases(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load purchase bills";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { purchases, meta, isLoading, refetch: fetch };
}
