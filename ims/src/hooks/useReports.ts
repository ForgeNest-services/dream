import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  reportsApi,
  type StockSummaryRowDto,
  type MarginRowDto,
  type PartyStatementRowDto,
} from "@/lib/reports-api";
import type { PageMeta } from "@/lib/api-client";

export interface StockSummaryQuery {
  branch_id?: string;
  category_id?: string;
  q?: string;
  low_stock_only?: boolean;
  page?: number;
  per_page?: number;
}

export function useStockSummaryReport(options: StockSummaryQuery = {}) {
  const { branch_id, category_id, q, low_stock_only, page, per_page } = options;
  const params = useMemo<StockSummaryQuery>(
    () => ({ branch_id, category_id, q, low_stock_only, page, per_page }),
    [branch_id, category_id, q, low_stock_only, page, per_page],
  );
  const [rows, setRows] = useState<StockSummaryRowDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await reportsApi.stockSummary(params);
      setRows(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, meta, isLoading, refetch: fetch };
}

export interface MarginQuery {
  branch_id?: string;
  category_id?: string;
  bs_from?: string;
  bs_to?: string;
  page?: number;
  per_page?: number;
}

export function useMarginReport(options: MarginQuery = {}) {
  const { branch_id, category_id, bs_from, bs_to, page, per_page } = options;
  const params = useMemo<MarginQuery>(
    () => ({ branch_id, category_id, bs_from, bs_to, page, per_page }),
    [branch_id, category_id, bs_from, bs_to, page, per_page],
  );
  const [rows, setRows] = useState<MarginRowDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await reportsApi.margin(params);
      setRows(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, meta, isLoading, refetch: fetch };
}

export interface PartyStatementQuery {
  kind: "customer" | "supplier";
  q?: string;
  bs_from?: string;
  bs_to?: string;
  page?: number;
  per_page?: number;
}

export function usePartyStatementReport(options: PartyStatementQuery) {
  const { kind, q, bs_from, bs_to, page, per_page } = options;
  const params = useMemo<PartyStatementQuery>(
    () => ({ kind, q, bs_from, bs_to, page, per_page }),
    [kind, q, bs_from, bs_to, page, per_page],
  );
  const [rows, setRows] = useState<PartyStatementRowDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await reportsApi.partyStatement(params);
      setRows(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, meta, isLoading, refetch: fetch };
}
