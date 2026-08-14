import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/context/app-store";
import { DateText, Money, PageHeader, StatCard, StatusPill } from "@/components/common/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Package, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/format";

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

function DashboardPage() {
  const app = useApp();
  const inBranch = <T extends { branchId: string }>(rows: T[]) =>
    app.branchId === "all" ? rows : rows.filter((r) => r.branchId === app.branchId);

  const invoices = inBranch(app.invoices.filter((i) => i.kind !== "quotation"));
  const movements = inBranch(app.movements);

  const totalSales = invoices.reduce((s, i) => s + app.invoiceTotal(i), 0);
  const receivable = app.parties
    .filter((p) => p.kind === "customer")
    .reduce((s, p) => s + Math.max(0, app.partyBalance(p.id)), 0);
  const payable = app.parties
    .filter((p) => p.kind === "supplier")
    .reduce((s, p) => s + Math.max(0, app.partyBalance(p.id)), 0);
  const stockValue = app.variants.reduce((s, v) => s + app.stockOf(v) * v.costPrice, 0);
  const lowStock = app.variants.filter((v) => app.stockOf(v) <= v.lowStockAt);

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (11 - i) * 5);
    const key = d.toISOString().slice(0, 10);
    const value = invoices
      .filter((inv) => Math.abs(new Date(inv.date).getTime() - d.getTime()) < 2.5 * 86400000)
      .reduce((s, inv) => s + app.invoiceTotal(inv), 0);
    return { date: key.slice(5), value };
  });

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-6">
      <PageHeader
        title={`Good day, ${app.currentUser?.name.split(" ")[0]}`}
        subtitle={
          app.branchId === "all"
            ? "Consolidated across all branches"
            : (app.branches.find((b) => b.id === app.branchId)?.name ?? "Branch")
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Sales (period)"
          value={<Money value={totalSales} />}
          hint={`${invoices.length} invoices`}
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label="Receivables"
          value={<Money value={receivable} />}
          tone="warning"
          hint="Unpaid from customers"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Payables"
          value={<Money value={payable} />}
          tone="destructive"
          hint="Owed to suppliers"
          icon={<ArrowDownRight className="h-4 w-4" />}
        />
        <StatCard
          label="Stock value"
          value={<Money value={stockValue} />}
          hint="At cost price"
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          label="Low stock"
          value={lowStock.length}
          tone={lowStock.length ? "warning" : "success"}
          hint="Variants at or below threshold"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-medium">Sales trend</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 8 }}>
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
          <h2 className="text-sm font-medium">Low stock alerts</h2>
          <div className="mt-3 space-y-2">
            {lowStock.slice(0, 7).map((v) => {
              const p = app.products.find((x) => x.id === v.productId);
              return (
                <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{p?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{v.name}</p>
                  </div>
                  <StatusPill status={app.stockOf(v) === 0 ? "out" : "low"} />
                </div>
              );
            })}
            {lowStock.length === 0 && (
              <p className="text-sm text-muted-foreground">Everything is above threshold.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-medium">Recent stock movements</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.slice(0, 8).map((m) => {
              const p = app.products.find((x) => x.id === m.productId);
              const v = app.variants.find((x) => x.id === m.variantId);
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <DateText value={m.date} />
                  </TableCell>
                  <TableCell>
                    <span className="block">{p?.name}</span>
                    <span className="text-xs text-muted-foreground">{v?.name}</span>
                  </TableCell>
                  <TableCell className="capitalize">{m.type.replace("-", " ")}</TableCell>
                  <TableCell
                    className={`num text-right ${m.qty >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {m.qty > 0 ? "+" : ""}
                    {m.qty}
                  </TableCell>
                  <TableCell className="num text-right">{m.balanceAfter}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
