import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NPR } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { toBsIso, formatDateWithStoredBs } from "@/lib/pos/nepali-date";
import {
  reportsApi,
  asNum,
  type SummaryDto,
  type TopItemDto,
} from "@/lib/reports-api";
import { useOrdersList } from "@/hooks/useOrdersList";
import type { ReportsSearch } from "@/routes/_app.reports";
import { BsDatePicker } from "./BsDatePicker";

const REPORTS_ROUTE = "/_app/reports" as const;

const TABS: { id: ReportsSearch["tab"]; label: string }[] = [
  { id: "orders", label: "Order wise" },
  { id: "category", label: "Category wise" },
  { id: "items", label: "Menu wise" },
];

export function ReportsView() {
  const { branchId, tables, settings } = usePos();
  const search = useSearch({ from: REPORTS_ROUTE });
  const navigate = useNavigate();

  // Fall back to last-7-days if the URL doesn't specify a range. Kept as
  // local state seeded from search so first-mount doesn't re-render twice;
  // any user change goes through patchSearch → URL → re-read.
  const todayBs = toBsIso(new Date()) ?? "";
  const weekAgoBs = toBsIso(new Date(Date.now() - 6 * 86400000)) ?? "";
  const fromBs = search.bs_from || weekAgoBs;
  const toBs = search.bs_to || todayBs;

  const patchSearch = (patch: Partial<ReportsSearch>) => {
    navigate({
      to: REPORTS_ROUTE,
      search: (prev: ReportsSearch) => ({ ...prev, ...patch }),
      replace: true,
    });
  };

  // Summary — stats, by-category, by-payment, expenses breakdown.
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!branchId || !fromBs || !toBs) return;
    let cancelled = false;
    setSummaryLoading(true);
    reportsApi
      .rangeSummary(branchId, fromBs, toBs)
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) setSummary(r.data);
        else toast.error("Failed to load summary");
      })
      .catch(() => !cancelled && toast.error("Failed to load summary"))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, fromBs, toBs]);

  // Top items — only fetches when the items tab is active.
  const [items, setItems] = useState<TopItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    if (!branchId || search.tab !== "items" || !fromBs || !toBs) return;
    let cancelled = false;
    setItemsLoading(true);
    reportsApi
      .topItems(branchId, fromBs, toBs, 50)
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) setItems(r.data);
      })
      .catch(() => !cancelled && toast.error("Failed to load menu breakdown"))
      .finally(() => !cancelled && setItemsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, fromBs, toBs, search.tab]);

  const { orders, meta, isLoading: ordersLoading } = useOrdersList(branchId || null, {
    bs_from: fromBs || undefined,
    bs_to: toBs || undefined,
    status: search.status === "all" ? undefined : search.status,
    type: search.type === "all" ? undefined : search.type,
    page: 1,
    per_page: 100,
  });

  const salesGross = asNum(summary?.sales_gross);
  const expensesTotal = asNum(summary?.expenses_total);
  const net = asNum(summary?.net);
  const paidCount = summary?.orders.paid ?? 0;
  const itemsSold = summary?.items_sold ?? 0;

  const stats = [
    { label: "Closed bills", value: String(paidCount) },
    { label: "Items sold", value: String(itemsSold) },
    { label: "Sales (gross)", value: NPR(salesGross) },
    { label: "Expenses", value: NPR(expensesTotal) },
    {
      label: "Net (sales − expenses)",
      value: NPR(net),
      tone: net < 0 ? "danger" : "primary",
    },
  ];

  const orderLabel = (o: (typeof orders)[number]) =>
    o.type === "delivery"
      ? (o.customer?.name ?? "Delivery")
      : (tables.find((t) => t.id === o.table_id)?.label ?? "Walk-in");

  const billTotalFromDto = (o: (typeof orders)[number]) => {
    const subtotal = o.lines
      .filter((l) => !l.is_voided)
      .reduce((s, l) => s + Number(l.price) * l.qty, 0);
    const discount =
      o.discount_type === "percent"
        ? (subtotal * Number(o.discount_value)) / 100
        : Number(o.discount_value);
    const taxable = Math.max(0, subtotal - discount);
    const vat = settings.vatEnabled ? (taxable * settings.vatRate) / 100 : 0;
    return taxable + vat;
  };

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h2 className="truncate font-display text-2xl">Sales reports</h2>
        <p className="text-xs text-muted-foreground">Filter by date, status and order type</p>
      </div>

      <div className="pos-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label>From (BS)</Label>
          <BsDatePicker value={fromBs} onChange={(v) => patchSearch({ bs_from: v })} />
        </div>
        <div className="space-y-2">
          <Label>To (BS)</Label>
          <BsDatePicker value={toBs} onChange={(v) => patchSearch({ bs_to: v })} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={search.status}
            onValueChange={(v) => patchSearch({ status: v as ReportsSearch["status"] })}
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Closed</SelectItem>
              <SelectItem value="draft">Running</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Order type</Label>
          <Select
            value={search.type}
            onValueChange={(v) => patchSearch({ type: v as ReportsSearch["type"] })}
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="dine-in">Dine-in</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
            </SelectContent>
          </Select>
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

      {summary && summary.expenses_by_category.length > 0 && (
        <div className="pos-card p-4">
          <h3 className="font-display text-lg">Expenses breakdown</h3>
          <ul className="mt-3 space-y-2">
            {summary.expenses_by_category.map((c) => (
              <li key={c.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{c.category}</span>
                <span className="shrink-0 font-medium">{NPR(asNum(c.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => patchSearch({ tab: t.id })}
            className={`min-h-11 shrink-0 rounded-xl px-4 text-sm transition-colors ${
              search.tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pos-card overflow-x-auto p-4 sm:p-5">
        {search.tab === "orders" && (
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3">Bill</th>
                <th className="py-3 pr-3">Table / Customer</th>
                <th className="py-3 pr-3">Date</th>
                <th className="py-3 pr-3">Items</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border/70 align-top">
                  <td className="py-3 pr-3">#{o.bill_number}</td>
                  <td className="py-3 pr-3">{orderLabel(o)}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {formatDateWithStoredBs(
                      new Date(o.placed_at).getTime(),
                      o.placed_at_bs,
                    )}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {o.lines
                      .map(
                        (l) =>
                          `${l.qty}× ${l.name}${l.variant_name ? ` (${l.variant_name})` : ""}`,
                      )
                      .join(", ")}
                  </td>
                  <td className="py-3 pr-3">
                    {o.status === "paid" ? "Closed" : o.status === "draft" ? "Running" : o.status}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {NPR(billTotalFromDto(o))}
                  </td>
                </tr>
              ))}
              {!ordersLoading && orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No orders match these filters.
                  </td>
                </tr>
              )}
              {ordersLoading && orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading bills…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {search.tab === "category" && (
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3">Category</th>
                <th className="py-3 pr-3">Qty</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary?.by_category.map((r) => (
                <tr key={r.category} className="border-b border-border/70">
                  <td className="py-3 pr-3">{r.category}</td>
                  <td className="py-3 pr-3 text-muted-foreground">{r.qty}</td>
                  <td className="py-3 text-right font-semibold">{NPR(asNum(r.revenue))}</td>
                </tr>
              ))}
              {summary && summary.by_category.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nothing sold in this range.
                  </td>
                </tr>
              )}
              {summaryLoading && !summary && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {search.tab === "items" && (
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3">Item</th>
                <th className="py-3 pr-3">Qty</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const name = r.variant_name ? `${r.name} (${r.variant_name})` : r.name;
                return (
                  <tr key={`${r.name}-${r.variant_name ?? ""}`} className="border-b border-border/70">
                    <td className="py-3 pr-3">{name}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{r.qty}</td>
                    <td className="py-3 text-right font-semibold">{NPR(asNum(r.revenue))}</td>
                  </tr>
                );
              })}
              {!itemsLoading && items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nothing sold in this range.
                  </td>
                </tr>
              )}
              {itemsLoading && items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {search.tab === "orders" && meta && meta.total > orders.length && (
        <p className="pos-card p-3 text-center text-xs text-muted-foreground">
          Showing {orders.length} of {meta.total} bills · narrow the date range for a
          more focused view
        </p>
      )}
    </div>
  );
}
