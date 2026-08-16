import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Calendar, Download, FileSpreadsheet, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NPR } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { toBsIso, bsIsoToPretty, formatDateWithStoredBs } from "@/lib/pos/nepali-date";
import {
  reportsApi,
  asNum,
  type SummaryDto,
  type TopItemDto,
} from "@/lib/reports-api";
import { exportReportPdf, exportReportXlsx } from "@/lib/reports-export";
import { useOrdersList } from "@/hooks/useOrdersList";
import type { ReportsSearch } from "@/routes/_app.reports";
import { BsDatePicker } from "./BsDatePicker";

// Route ID for the typed useSearch read. `useNavigate()` is called WITHOUT
// `from` — passing `from` there would resolve the route ID as a URL and land
// on the literal "/_app/reports" path which doesn't exist → 404.
const REPORTS_ROUTE = "/_app/reports" as const;

const TABS: { id: ReportsSearch["tab"]; label: string }[] = [
  { id: "orders", label: "Order wise" },
  { id: "category", label: "Category wise" },
  { id: "items", label: "Menu wise" },
];

// Quick preset ranges — click, done. `todayBs` is the anchor, ranges are
// computed relative to it so "This month (BS)" isn't literally the
// Gregorian month.
type Preset = { label: string; from: (todayBs: string) => string; to: (todayBs: string) => string };
const PRESETS: Preset[] = [
  { label: "Today", from: (t) => t, to: (t) => t },
  {
    label: "Yesterday",
    from: (t) => bsShift(t, -1),
    to: (t) => bsShift(t, -1),
  },
  { label: "Last 7 days", from: (t) => bsShift(t, -6), to: (t) => t },
  { label: "Last 30 days", from: (t) => bsShift(t, -29), to: (t) => t },
];

function bsShift(bsIso: string, days: number): string {
  // Round-trip through the JS Date arithmetic. We already have toBsIso;
  // shifting by days works because BS<->AD is 1:1 by day.
  const jsToday = new Date();
  const currentBsToday = toBsIso(jsToday);
  if (!currentBsToday) return bsIso;
  // Compute offset between passed bs and today, then apply that plus `days`
  // to jsToday. Only need this to be correct for small ranges (< a year).
  const offsetDays = bsDaysDiff(bsIso, currentBsToday);
  const target = new Date(jsToday.getTime() + (offsetDays + days) * 86400000);
  return toBsIso(target) ?? bsIso;
}

// Cheap-and-cheerful: convert both to AD via a scratch calculation. We don't
// have `bsIsoToAd` on the client, but for the preset use-case both dates are
// close to today, so we can approximate by parsing the numeric components
// and treating one BS day == one AD day (true) and using the difference in
// (year*365 + month*31 + day) as an offset seed. This isn't exact across
// month boundaries, but the presets only need day-count precision — and
// we're always shifting from `today` so the seed cancels out.
function bsDaysDiff(a: string, b: string): number {
  // For "today" comparisons the strings will be identical, so the diff is 0.
  // Left as a stub for future presets that might need real BS date math —
  // for now the four presets above all pin against today, so we return 0
  // and rely on the caller's `days` shift.
  if (a === b) return 0;
  // Fallback: rough approximation via JS Date parse of the numeric bits.
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return (ya - yb) * 365 + (ma - mb) * 30 + (da - db);
}

export function ReportsView() {
  const { branchId, branch, tables, settings } = usePos();
  const search = useSearch({ from: REPORTS_ROUTE });
  const navigate = useNavigate();

  const todayBs = toBsIso(new Date()) ?? "";
  const weekAgoBs = toBsIso(new Date(Date.now() - 6 * 86400000)) ?? "";
  const fromBs = search.bs_from || weekAgoBs;
  const toBs = search.bs_to || todayBs;

  const patchSearch = (patch: Partial<ReportsSearch>) => {
    navigate({
      search: (prev: ReportsSearch) => ({ ...prev, ...patch }),
      replace: true,
    });
  };

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

  const [items, setItems] = useState<TopItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    // Fetch top items eagerly (not only when tab === 'items') because export
    // needs them regardless of which tab is open.
    if (!branchId || !fromBs || !toBs) return;
    let cancelled = false;
    setItemsLoading(true);
    reportsApi
      .topItems(branchId, fromBs, toBs, 100)
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) setItems(r.data);
      })
      .catch(() => !cancelled && toast.error("Failed to load menu breakdown"))
      .finally(() => !cancelled && setItemsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, fromBs, toBs]);

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

  const rangeLabel = useMemo(() => {
    if (!fromBs || !toBs) return "";
    if (fromBs === toBs) return bsIsoToPretty(fromBs);
    return `${bsIsoToPretty(fromBs)} → ${bsIsoToPretty(toBs)}`;
  }, [fromBs, toBs]);

  const canExport = Boolean(summary && !summaryLoading);
  const doExport = (fmt: "xlsx" | "pdf") => {
    if (!summary) return;
    const ctx = {
      branchName: branch?.name ?? "Branch",
      bsFrom: fromBs,
      bsTo: toBs,
      summary,
      orders,
      topItems: items,
      vatEnabled: settings.vatEnabled,
      vatRate: settings.vatRate,
    };
    try {
      if (fmt === "xlsx") exportReportXlsx(ctx);
      else exportReportPdf(ctx);
      toast.success(`Report downloaded (${fmt.toUpperCase()})`);
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  };

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

  // ------ layout ------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Header — title + range chip + export */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">Sales reports</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="size-3.5" />
            <span className="truncate">{rangeLabel || "Pick a date range"}</span>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-11 shrink-0 gap-2"
              disabled={!canExport}
            >
              <Download className="size-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => doExport("xlsx")}>
              <FileSpreadsheet className="mr-2 size-4" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => doExport("pdf")}>
              <Download className="mr-2 size-4" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters — presets on top, custom range + filters below */}
      <div className="pos-card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Quick range
          </span>
          {PRESETS.map((p) => {
            const from = p.from(todayBs);
            const to = p.to(todayBs);
            const active = fromBs === from && toBs === to;
            return (
              <button
                key={p.label}
                onClick={() => patchSearch({ bs_from: from, bs_to: to })}
                className={`min-h-9 rounded-full px-3 text-xs transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">From (BS)</Label>
            <BsDatePicker value={fromBs} onChange={(v) => patchSearch({ bs_from: v })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To (BS)</Label>
            <BsDatePicker value={toBs} onChange={(v) => patchSearch({ bs_to: v })} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs">
              <Filter className="size-3" />
              Status (bills tab)
            </Label>
            <Select
              value={search.status}
              onValueChange={(v) => patchSearch({ status: v as ReportsSearch["status"] })}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paid">Closed</SelectItem>
                <SelectItem value="draft">Running</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs">
              <Filter className="size-3" />
              Order type (bills tab)
            </Label>
            <Select
              value={search.type}
              onValueChange={(v) => patchSearch({ type: v as ReportsSearch["type"] })}
            >
              <SelectTrigger className="h-11">
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
      </div>

      {/* KPI band — 3 rows: revenue block (highlighted), volume block, P&L block */}
      <div className="grid gap-3 xl:grid-cols-3">
        <KpiCard
          label="Sales (gross)"
          value={NPR(salesGross)}
          sub={`${paidCount} closed bill${paidCount === 1 ? "" : "s"}`}
          tone="primary"
          large
        />
        <KpiCard
          label="Expenses"
          value={NPR(expensesTotal)}
          sub={
            summary && summary.expenses_by_category.length > 0
              ? `${summary.expenses_by_category.length} categor${summary.expenses_by_category.length === 1 ? "y" : "ies"}`
              : "No expenses in range"
          }
        />
        <KpiCard
          label="Net (sales − expenses)"
          value={NPR(net)}
          sub={net < 0 ? "Operating at a loss" : "Operating profit"}
          tone={net < 0 ? "danger" : "primary"}
          large
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Items sold" value={String(itemsSold)} sub="Non-voided lines" />
        <KpiCard
          label="Running bills"
          value={String(summary?.orders.draft ?? 0)}
          sub="Not yet closed"
        />
        <KpiCard
          label="Cancelled"
          value={String(summary?.orders.cancelled ?? 0)}
          sub="Voided bills"
        />
      </div>

      {/* Payment methods — always visible, gives at-a-glance cash-flow split */}
      {summary && (
        <div className="pos-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg">Payments received</h3>
            <span className="text-xs text-muted-foreground">Cash / QR / Khata split</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(["cash", "qr", "khata"] as const).map((m) => {
              const b = summary.by_payment[m];
              return (
                <div
                  key={m}
                  className="rounded-xl border border-border/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {m}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {b.count} bill{b.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1.5 font-display text-lg font-semibold">
                    {NPR(asNum(b.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expenses breakdown — only when there's data, keeps the page compact */}
      {summary && summary.expenses_by_category.length > 0 && (
        <div className="pos-card p-4">
          <h3 className="font-display text-lg">Expenses by category</h3>
          <ExpenseBars items={summary.expenses_by_category} total={expensesTotal} />
        </div>
      )}

      {/* Tabs — larger, clearer */}
      <div className="rounded-2xl bg-secondary/40 p-1.5">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => patchSearch({ tab: t.id })}
              className={`min-h-11 flex-1 shrink-0 rounded-xl px-4 text-sm font-medium transition-colors ${
                search.tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pos-card overflow-x-auto p-4 sm:p-5">
        {search.tab === "orders" && (
          <BillsTable
            orders={orders}
            loading={ordersLoading}
            settings={settings}
            billTotalFromDto={billTotalFromDto}
            orderLabel={orderLabel}
          />
        )}

        {search.tab === "category" && (
          <CategoryTable summary={summary} loading={summaryLoading} />
        )}

        {search.tab === "items" && (
          <ItemsTable items={items} loading={itemsLoading} />
        )}
      </div>

      {search.tab === "orders" && meta && meta.total > orders.length && (
        <p className="pos-card p-3 text-center text-xs text-muted-foreground">
          Showing {orders.length} of {meta.total} bills — narrow the date range or
          filters for a more focused view.
        </p>
      )}
    </div>
  );
}

// ----- sub-components ------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
  large = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "primary" | "danger";
  large?: boolean;
}) {
  const valueClass =
    tone === "danger"
      ? "text-danger"
      : tone === "primary"
        ? "text-primary"
        : "text-foreground";
  return (
    <div className="pos-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 font-display font-semibold ${valueClass} ${large ? "text-2xl" : "text-xl"}`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ExpenseBars({
  items,
  total,
}: {
  items: { category: string; amount: string }[];
  total: number;
}) {
  const max = Math.max(...items.map((i) => asNum(i.amount)), 1);
  return (
    <ul className="mt-3 space-y-3">
      {items.map((c) => {
        const amt = asNum(c.amount);
        const pct = (amt / max) * 100;
        const share = total > 0 ? (amt / total) * 100 : 0;
        return (
          <li key={c.category}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{c.category}</span>
              <span className="shrink-0 text-muted-foreground">
                {share.toFixed(0)}% · {NPR(amt)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BillsTable({
  orders,
  loading,
  settings,
  billTotalFromDto,
  orderLabel,
}: {
  orders: import("@/lib/orders-api").OrderDto[];
  loading: boolean;
  settings: { vatEnabled: boolean; vatRate: number };
  billTotalFromDto: (o: import("@/lib/orders-api").OrderDto) => number;
  orderLabel: (o: import("@/lib/orders-api").OrderDto) => string;
}) {
  // settings intentionally not used inline — captured by billTotalFromDto
  void settings;
  return (
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
          <tr key={o.id} className="border-b border-border/70 align-top hover:bg-secondary/30">
            <td className="py-3 pr-3 font-medium">#{o.bill_number}</td>
            <td className="py-3 pr-3">{orderLabel(o)}</td>
            <td className="py-3 pr-3 text-muted-foreground">
              {formatDateWithStoredBs(new Date(o.placed_at).getTime(), o.placed_at_bs)}
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
              <StatusPill status={o.status} />
            </td>
            <td className="py-3 text-right font-semibold">
              {NPR(billTotalFromDto(o))}
            </td>
          </tr>
        ))}
        {!loading && orders.length === 0 && (
          <tr>
            <td colSpan={6} className="py-12 text-center text-muted-foreground">
              No orders match these filters.
            </td>
          </tr>
        )}
        {loading && orders.length === 0 && (
          <tr>
            <td colSpan={6} className="py-12 text-center text-muted-foreground">
              Loading bills…
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-primary/10 text-primary",
    draft: "bg-warning/10 text-warning",
    cancelled: "bg-danger/10 text-danger",
  };
  const label = status === "paid" ? "Closed" : status === "draft" ? "Running" : status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        map[status] ?? "bg-secondary text-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function CategoryTable({
  summary,
  loading,
}: {
  summary: SummaryDto | null;
  loading: boolean;
}) {
  return (
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
          <tr key={r.category} className="border-b border-border/70 hover:bg-secondary/30">
            <td className="py-3 pr-3 font-medium">{r.category}</td>
            <td className="py-3 pr-3 text-muted-foreground">{r.qty}</td>
            <td className="py-3 text-right font-semibold">{NPR(asNum(r.revenue))}</td>
          </tr>
        ))}
        {summary && summary.by_category.length === 0 && (
          <tr>
            <td colSpan={3} className="py-12 text-center text-muted-foreground">
              Nothing sold in this range.
            </td>
          </tr>
        )}
        {loading && !summary && (
          <tr>
            <td colSpan={3} className="py-12 text-center text-muted-foreground">
              Loading…
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ItemsTable({
  items,
  loading,
}: {
  items: TopItemDto[];
  loading: boolean;
}) {
  return (
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
            <tr
              key={`${r.name}-${r.variant_name ?? ""}`}
              className="border-b border-border/70 hover:bg-secondary/30"
            >
              <td className="py-3 pr-3 font-medium">{name}</td>
              <td className="py-3 pr-3 text-muted-foreground">{r.qty}</td>
              <td className="py-3 text-right font-semibold">{NPR(asNum(r.revenue))}</td>
            </tr>
          );
        })}
        {!loading && items.length === 0 && (
          <tr>
            <td colSpan={3} className="py-12 text-center text-muted-foreground">
              Nothing sold in this range.
            </td>
          </tr>
        )}
        {loading && items.length === 0 && (
          <tr>
            <td colSpan={3} className="py-12 text-center text-muted-foreground">
              Loading…
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
