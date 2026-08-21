import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { invoicesApi, type InvoiceDto } from "@/lib/invoices-api";
import type { PageMeta } from "@/lib/api-client";

export interface InvoicesQuery {
  branch_id?: string;
  customer_id?: string;
  status?: string;
  q?: string;
  bs_from?: string;
  bs_to?: string;
  page?: number;
  per_page?: number;
}

export function useInvoices(options: InvoicesQuery = {}) {
  const { branch_id, customer_id, status, q, bs_from, bs_to, page, per_page } = options;

  const params = useMemo<InvoicesQuery>(
    () => ({ branch_id, customer_id, status, q, bs_from, bs_to, page, per_page }),
    [branch_id, customer_id, status, q, bs_from, bs_to, page, per_page],
  );

  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await invoicesApi.list(params);
      setInvoices(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load invoices";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { invoices, meta, isLoading, refetch: fetch };
}
