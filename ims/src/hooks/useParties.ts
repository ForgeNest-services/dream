import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { partiesApi, type PartyDto } from "@/lib/parties-api";
import type { PageMeta } from "@/lib/api-client";

export interface PartiesQuery {
  kind?: "supplier" | "customer";
  q?: string;
  page?: number;
  per_page?: number;
}

export function useParties(options: PartiesQuery = {}) {
  const { kind, q, page, per_page } = options;

  const params = useMemo<PartiesQuery>(
    () => ({ kind, q, page, per_page }),
    [kind, q, page, per_page],
  );

  const [parties, setParties] = useState<PartyDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await partiesApi.list(params.kind, { q: params.q, page: params.page, per_page: params.per_page });
      setParties(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load parties";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { parties, meta, isLoading, refetch: fetch };
}
