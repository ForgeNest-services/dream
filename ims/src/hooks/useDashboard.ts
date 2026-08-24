import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { dashboardApi, type DashboardDataDto } from "@/lib/dashboard-api";

export interface DashboardQuery {
  branch_id?: string;
  bs_from?: string;
  bs_to?: string;
}

export function useDashboard(options: DashboardQuery = {}) {
  const { branch_id, bs_from, bs_to } = options;
  const params = useMemo<DashboardQuery>(
    () => ({ branch_id, bs_from, bs_to }),
    [branch_id, bs_from, bs_to],
  );

  const [data, setData] = useState<DashboardDataDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await dashboardApi.get(params);
      setData(res.data ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, refetch: fetch };
}
