import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AlertTriangle, Receipt, TrendingUp, Utensils } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { NPR } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { reportsApi, asNum, type DashboardDto } from "@/lib/reports-api";
import { bsIsoToPretty, toBsIso } from "@/lib/pos/nepali-date";
import { BsDatePicker } from "./BsDatePicker";
import type { DashboardSearch } from "@/routes/_app.dashboard";

const DASHBOARD_ROUTE = "/_app/dashboard" as const;

function Stat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <div className="pos-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl leading-none">{value}</p>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">{sub}</p>
    </div>
  );
}

const shortBs = (bsIso: string) => {
  const [, m, d] = bsIso.split("-");
  return `${Number(m)}/${Number(d)}`;
};

function pctDelta(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "First sales this day" : "No sales previous day";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% vs previous day`;
}

export function DashboardView() {
  const { branchId } = usePos();
  const search = useSearch({ from: DASHBOARD_ROUTE });
  const navigate = useNavigate();

  // If the URL doesn't specify a date, resolve to today at render time so a
  // bookmark always opens "today's" dashboard, not the day the link was made.
  const todayBs = toBsIso(new Date()) ?? "";
  const activeBs = search.bs || todayBs;
  const isToday = !search.bs || search.bs === todayBs;

  const setDate = (bs: string) => {
    // Do NOT pass `to: DASHBOARD_ROUTE` here — the router would resolve the
    // route ID "/_app/dashboard" as a literal URL and 404. Omitting `to`
    // keeps navigation on the current route and just patches the search.
    //
    // Return {} (not {bs: ""}) when going back to today so TanStack drops
    // the key entirely — otherwise the URL keeps a dangling "?bs=".
    // `resetScroll: false` keeps the user where they were on the page.
    navigate({
      search: (): DashboardSearch => (bs === todayBs ? {} : { bs }),
      replace: true,
      resetScroll: false,
    });
  };

  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);
    reportsApi
      .dashboard(branchId, search.bs || undefined)
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) setData(r.data);
        else toast.error("Failed to load dashboard");
      })
      .catch(() => !cancelled && toast.error("Failed to load dashboard"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, search.bs]);

  const dateHeader = (
    <div className="pos-card flex flex-wrap items-end justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Viewing
        </p>
        <p className="font-display text-lg">
          {isToday ? "Today" : bsIsoToPretty(activeBs)}
        </p>
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">BS date</Label>
          <div className="w-56">
            <BsDatePicker value={activeBs} onChange={setDate} />
          </div>
        </div>
        {!isToday && (
          <button
            className="min-h-11 shrink-0 rounded-xl bg-secondary px-4 text-sm"
            onClick={() => setDate(todayBs)}
          >
            Today
          </button>
        )}
      </div>
    </div>
  );

  if (!data) {
    return (
      <div className="space-y-4">
        {dateHeader}
        <div className="pos-card p-8 text-center text-sm text-muted-foreground">
          {loading ? "Loading dashboard…" : "No data yet."}
        </div>
      </div>
    );
  }

  const salesActive = asNum(data.today.sales_gross);
  const yesterday = asNum(data.yesterday_sales);
  const paidCount = data.today.orders.paid;
  const draftCount = data.today.orders.draft;
  const orderCountLabel = `${draftCount + paidCount}`;
  const orderSub = `${draftCount} running, ${paidCount} closed`;
  const expensesTotal = asNum(data.today.expenses_total);
  const net = asNum(data.today.net);

  const trend = data.trend_7_days.map((r) => ({
    day: shortBs(r.bs_date),
    fullDate: r.bs_date,
    sales: asNum(r.sales),
    expenses: asNum(r.expenses),
  }));

  return (
    <div className="space-y-5">
      {dateHeader}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={isToday ? "Today's Sales" : "Sales"}
          value={NPR(salesActive)}
          sub={pctDelta(salesActive, yesterday)}
          icon={TrendingUp}
        />
        <Stat label="Orders" value={orderCountLabel} sub={orderSub} icon={Receipt} />
        <Stat
          label="Tables Occupied"
          value={`${data.tables.occupied}/${data.tables.total}`}
          sub="Live floor status"
          icon={Utensils}
        />
        <Stat
          label="Low Stock Alerts"
          value={String(data.low_stock_count)}
          sub={data.low_stock_count === 0 ? "All good" : "Needs restocking"}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="pos-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Sales (gross)</p>
          <p className="mt-1 font-display text-xl font-semibold text-primary">
            {NPR(salesActive)}
          </p>
        </div>
        <div className="pos-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Expenses</p>
          <p className="mt-1 font-display text-xl font-semibold">
            {NPR(expensesTotal)}
          </p>
        </div>
        <div className="pos-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Net (sales − expenses)
          </p>
          <p
            className={`mt-1 font-display text-xl font-semibold ${
              net < 0 ? "text-danger" : "text-primary"
            }`}
          >
            {NPR(net)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="pos-card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Sales trend</h2>
          <p className="text-xs text-muted-foreground">
            7 days ending {isToday ? "today" : bsIsoToPretty(activeBs)} (BS)
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={64} />
                <Tooltip
                  formatter={(val: number) => NPR(val)}
                  labelFormatter={(_, ttItems) => {
                    const p = ttItems && ttItems[0] && (ttItems[0].payload as { fullDate: string });
                    return p ? bsIsoToPretty(p.fullDate) : "";
                  }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Top selling items</h2>
          <p className="text-xs text-muted-foreground">Last 7 days</p>
          <ul className="mt-4 space-y-3">
            {data.top_items.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No sales in the last 7 days.
              </li>
            )}
            {data.top_items.map((item, i) => (
              <li key={`${item.name}-${item.variant_name ?? ""}`} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy font-display text-lg text-navy-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.name}
                    {item.variant_name ? ` · ${item.variant_name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.qty} sold</p>
                </div>
                <span className="shrink-0 text-sm font-medium text-primary">
                  {NPR(asNum(item.revenue))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {data.today.expenses_by_category.length > 0 && (
        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Expenses today</h2>
          <ul className="mt-3 space-y-2">
            {data.today.expenses_by_category.map((c) => (
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
    </div>
  );
}
