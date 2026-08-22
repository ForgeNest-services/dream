import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { productsApi, type ProductDto, type ProductsQuery } from "@/lib/products-api";
import type { PageMeta } from "@/lib/api-client";

export function useProducts(options: ProductsQuery = {}) {
  const { q, category_id, brand_id, stock_status, page, per_page } = options;

  const params = useMemo<ProductsQuery>(
    () => ({ q, category_id, brand_id, stock_status, page, per_page }),
    [q, category_id, brand_id, stock_status, page, per_page],
  );

  const [products, setProducts] = useState<ProductDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await productsApi.list(params);
      setProducts(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load products";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { products, meta, isLoading, refetch: fetch };
}
