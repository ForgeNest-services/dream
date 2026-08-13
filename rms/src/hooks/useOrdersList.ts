import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ordersApi, type OrderDto, type OrdersPaginatedQuery } from "@/lib/orders-api";
import type { PageMeta } from "@/lib/api-client";

/**
 * Fetches the *historical* orders list (BillsTable). Independent of the
 * store's `orders` state — that one keeps a small live cache for the
 * kitchen / delivery / dashboard views. Refetches whenever any filter
 * changes (search q, BS date range, status/type, page/perPage).
 *
 * The caller is expected to debounce free-text search before passing it in.
 */
export function useOrdersList(
  branchId: string | null,
  params: OrdersPaginatedQuery,
) {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable key from params so useEffect only fires on real changes and not
  // on every parent re-render (object identity would otherwise thrash).
  const key = useMemo(
    () =>
      JSON.stringify({
        branchId,
        status: params.status ?? "",
        type: params.type ?? "",
        table_id: params.table_id ?? "",
        q: params.q ?? "",
        bs_from: params.bs_from ?? "",
        bs_to: params.bs_to ?? "",
        page: params.page ?? 1,
        per_page: params.per_page ?? 25,
      }),
    [
      branchId,
      params.status,
      params.type,
      params.table_id,
      params.q,
      params.bs_from,
      params.bs_to,
      params.page,
      params.per_page,
    ],
  );

  const refetch = useCallback(async () => {
    if (!branchId) {
      setOrders([]);
      setMeta(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await ordersApi.paginated(branchId, params);
      setOrders(response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load orders";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { orders, meta, isLoading, error, refetch };
}
