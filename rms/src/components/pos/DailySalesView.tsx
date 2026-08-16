import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { NPR } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { toBsIso } from "@/lib/pos/nepali-date";
import { reportsApi, asNum, type SummaryDto } from "@/lib/reports-api";
import { BsDatePicker } from "./BsDatePicker";

export function DailySalesView() {
  const { branchId } = usePos();
  const todayBs = toBsIso(new Date()) ?? "";
  const [fromBs, setFromBs] = useState(todayBs);
  const [toBs, setToBs] = useState(todayBs);
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchId || !fromBs || !toBs) return;
    let cancelled = false;
    setLoading(true);
    // Same endpoint handles single-day + range — server accepts bs_from == bs_to.
    reportsApi
      .rangeSummary(branchId, fromBs, toBs)
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) setSummary(r.data);
        else toast.error("Failed to load report");
      })
      .catch(() => !cancelled && toast.error("Failed to load report"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, fromBs, toBs]);

  const salesGross = asNum(summary?.sales_gross);
  const expensesTotal = asNum(summary?.expenses_total);
  const net = asNum(summary?.net);
  const items = summary?.items_sold ?? 0;
  const paidCount = summary?.orders.paid ?? 0;

  const stats = [
    { label: "Orders closed", value: String(paidCount) },
    { label: "Items sold", value: String(items) },
    { label: "Sales (gross)", value: NPR(salesGross) },
    { label: "Expenses", value: NPR(expensesTotal) },
    {
      label: "Net (sales − expenses)",
      value: NPR(net),
      tone: net < 0 ? "danger" : "primary",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h2 className="truncate font-display text-2xl">Daily sales report</h2>
        <p className="text-xs text-muted-foreground">Defaults to today (BS) · pick a range to compare</p>
      </div>

      <div className="pos-card grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>From</Label>
          <BsDatePicker value={fromBs} onChange={setFromBs} />
        </div>
        <div className="space-y-2">
          <Label>To</Label>
          <BsDatePicker value={toBs} onChange={setToBs} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {stats.map((s) => {
          const tone = "tone" in s ? s.tone : "default";
          const valueClass =
            tone === "danger"
              ? "text-danger"
              : tone === "primary"
                ? "text-primary"
                : "text-foreground";
          return (
            <div key={s.label} className="pos-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className={`mt-1 font-display text-xl font-semibold ${valueClass}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {loading && !summary && (
        <p className="pos-card p-6 text-center text-sm text-muted-foreground">
          Loading report…
        </p>
      )}

      {summary && summary.expenses_by_category.length > 0 && (
        <div className="pos-card p-4">
          <h3 className="font-display text-lg">Expenses breakdown</h3>
          <ul className="mt-3 space-y-2">
            {summary.expenses_by_category.map((c) => (
              <li
                key={c.category}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate">{c.category}</span>
                <span className="shrink-0 font-medium">{NPR(asNum(c.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pos-card p-4">
        <h3 className="font-display text-lg">Category breakdown</h3>
        <ul className="mt-3 space-y-2">
          {summary?.by_category.map((c) => (
            <li key={c.category} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {c.category}
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.qty} sold
                </span>
              </span>
              <span className="shrink-0 font-medium">{NPR(asNum(c.revenue))}</span>
            </li>
          ))}
          {summary && summary.by_category.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              No orders in this date range yet.
            </li>
          )}
        </ul>
      </div>

      {summary && (
        <div className="pos-card p-4">
          <h3 className="font-display text-lg">Payment methods</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {(["cash", "qr", "khata"] as const).map((m) => {
              const b = summary.by_payment[m];
              return (
                <li
                  key={m}
                  className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium capitalize">{m}</p>
                    <p className="text-xs text-muted-foreground">{b.count} bills</p>
                  </div>
                  <span className="shrink-0 font-medium">{NPR(asNum(b.amount))}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
