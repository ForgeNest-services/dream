import { createFileRoute, Link } from "@tanstack/react-router";
import { useApp } from "@/context/app-store";
import { DashboardDateFilter } from "@/components/common/dashboard-date-filter";
import { DateText, Money, PageHeader, StatCard, StatusPill } from "@/components/common/primitives";
import { useDashboard } from "@/hooks/useDashboard";
import { formatBs, startOfMonthBs } from "@/lib/nepali-date";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SROTA IMS" },
      {
        name: "description",
        content:
          "Live view of sales, receivables, payables, stock value and low-stock alerts across all branches.",
      },
      { property: "og:title", content: "Dashboard — SROTA IMS" },
      {
        property: "og:description",
        content: "Sales, receivables, payables and stock health at a glance.",
      },
    ],
  }),
  component: DashboardPage,
});

const num = (v: number | string): number => Number(v);

const PIE_COLORS = [
  "var(--color-primary)",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

function DashboardPage() {
  const app = useApp();
  const today = formatBs(new Date());
  const [from, setFrom] = useState(startOfMonthBs());
  const [to, setTo] = useState(today);

  const { data, isLoading } = useDashboard({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    bs_from: from,
    bs_to: to,
  });

  const lowStockCount = data?.low_stock_count ?? 0;

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-6">
      <PageHeader
        title={`Good day, ${app.currentUser?.name.split(" ")[0]}`}
        subtitle={
          app.branchId === "all"
            ? "Consolidated across all branches"
            : (app.branches.find((b) => b.id === app.branchId)?.name ?? "Branch")
        }
        actions={<DashboardDateFilter from={from} to={to} onChange={(f, t) => (setFrom(f), setTo(t))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Sales (period)"
          value={<Money value={num(data?.sales_total ?? 0)} />}
          hint={`${data?.sales_count ?? 0} invoices`}
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label="Receivables"
          value={<Money value={num(data?.receivable ?? 0)} />}
          tone="warning"
          hint="Unpaid from customers"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Payables"
          value={<Money value={num(data?.payable ?? 0)} />}
          tone="destructive"
          hint="Owed to suppliers"
          icon={<ArrowDownRight className="h-4 w-4" />}
        />
        <StatCard
          label="Stock value"
          value={<Money value={num(data?.stock_value ?? 0)} />}
          hint="At cost price"
          icon={<Package className="h-4 w-4" />}
        />
        <Link to="/reports/low-stock">
          <StatCard
            label="Low stock"
            value={lowStockCount}
            tone={lowStockCount ? "warning" : "success"}
            hint="Variants at or below threshold"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-medium">Sales trend</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={(data?.sales_trend ?? []).map((p) => ({
                  date: p.date_bs.slice(5),
                  value: num(p.total),
                }))}
                margin={{ left: -18, right: 8, top: 8 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" width={70} />
                <Tooltip
                  formatter={(v: number) => formatMoney(v, app.currency)}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Sales by category</h2>
          {!isLoading && (data?.sales_by_category.length ?? 0) === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(data?.sales_by_category ?? []).map((c) => ({
                      name: c.category_name,
                      value: num(c.total),
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {(data?.sales_by_category ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatMoney(v, app.currency)}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="-mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {(data?.sales_by_category ?? []).slice(0, 6).map((c, i) => (
                  <span key={c.category_id ?? i} className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {c.category_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Top sellers</h2>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-3 space-y-2">
            {(data?.top_sellers ?? []).map((s) => (
              <div key={s.variant_id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{s.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.variant_name} · {s.qty_sold} sold
                  </p>
                </div>
                <span className="num shrink-0 font-medium">
                  <Money value={num(s.revenue)} />
                </span>
              </div>
            ))}
            {!isLoading && (data?.top_sellers.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No sales in this period.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Low stock alerts</h2>
          <div className="mt-3 space-y-2">
            {(data?.low_stock_alerts ?? []).map((v) => (
              <div key={v.variant_id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{v.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{v.variant_name}</p>
                </div>
                <StatusPill status={num(v.stock_qty) <= 0 ? "out" : "low"} />
              </div>
            ))}
            {!isLoading && (data?.low_stock_alerts.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Everything is above threshold.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Recent stock movements</h2>
          <div className="mt-3 space-y-2">
            {(data?.recent_movements ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{m.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground capitalize">
                    <DateText value={m.date} /> · {m.type.replace("-", " ")}
                  </p>
                </div>
                <span
                  className={`num shrink-0 font-medium ${num(m.qty) >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {num(m.qty) > 0 ? "+" : ""}
                  {m.qty}
                </span>
              </div>
            ))}
            {!isLoading && (data?.recent_movements.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
