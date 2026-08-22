import { useEffect, useState } from "react";
import { Money } from "@/components/common/primitives";
import { costHistoryApi, type CostHistoryEntryDto } from "@/lib/cost-history-api";
import { History, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const num = (v: number | string): number => Number(v);

/** Sourced from past purchase bills for this variant — not a separate log,
 *  since every purchase already snapshots the cost paid at the time
 *  (IMSPurchaseLine.unit_cost). Shows nothing for a variant that's never
 *  been restocked yet. */
export function CostHistoryPanel({
  variantId,
  className,
}: {
  variantId: string | undefined;
  className?: string;
}) {
  const [entries, setEntries] = useState<CostHistoryEntryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!variantId || !open) return;
    let cancelled = false;
    setLoading(true);
    costHistoryApi
      .forVariant(variantId)
      .then((res) => {
        if (!cancelled) setEntries(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [variantId, open]);

  if (!variantId) return null;

  return (
    <div className={cn("rounded-md border bg-muted/20", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <History className="h-3.5 w-3.5" />
        Cost history {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="border-t px-3 py-2">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : entries.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">
              No purchases recorded for this variant yet — cost price was set manually.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {entries.map((e, i) => {
                const prev = entries[i + 1];
                const cost = num(e.unit_cost);
                const prevCost = prev ? num(prev.unit_cost) : null;
                const delta = prevCost !== null ? cost - prevCost : null;
                return (
                  <li key={`${e.purchase_id}-${i}`} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {e.date.slice(0, 10)} · {e.bill_no || e.purchase_number}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Money value={cost} />
                      {delta !== null && delta !== 0 && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5",
                            delta > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {delta > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
