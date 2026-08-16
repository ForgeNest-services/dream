import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NPR } from "@/lib/pos/data";
import { billTotals, usePos } from "@/lib/pos/store";
import { formatDateWithStoredBs, toBsIso } from "@/lib/pos/nepali-date";
import { BsDatePicker } from "./BsDatePicker";

type Tab = "orders" | "category" | "items";

const TABS: { id: Tab; label: string }[] = [
  { id: "orders", label: "Order wise" },
  { id: "category", label: "Category wise" },
  { id: "items", label: "Menu wise" },
];

// Deprecated: use formatDateWithStoredBs(o.placedAt, o.placedAtBs) inline so
// the report reflects the exact BS date stamped on each order.

export function ReportsView() {
  const { orders, expenses, settings, categories, menu, tables } = usePos();
  const [tab, setTab] = useState<Tab>("orders");
  // Default range: last 7 days in BS. Filter operates on placed_at_bs
  // (backend-stamped, "YYYY-MM-DD"), which sorts lexically.
  const todayBs = toBsIso(new Date()) ?? "";
  const weekAgoBs = toBsIso(new Date(Date.now() - 6 * 86400000)) ?? "";
  const [fromBs, setFromBs] = useState(weekAgoBs);
  const [toBs, setToBs] = useState(todayBs);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const filtered = useMemo(
    () =>
      orders
        .filter((o) => o.placedAtBs >= fromBs && o.placedAtBs <= toBs)
        .filter((o) => (status === "all" ? true : o.status === status))
        .filter((o) => (type === "all" ? true : o.type === type))
        .sort((a, b) => b.placedAt - a.placedAt),
    [orders, fromBs, toBs, status, type],
  );

  const label = (o: (typeof orders)[number]) =>
    o.type === "delivery"
      ? (o.customer?.name ?? "Delivery")
      : (tables.find((t) => t.id === o.tableId)?.label ?? "Walk-in");

  const totalSales = filtered
    .filter((o) => o.status === "paid")
    .reduce((s, o) => s + billTotals(o, settings.vatEnabled, settings.vatRate).total, 0);

  const byCategory = categories
    .map((c) => ({
      name: c.name,
      qty: filtered.reduce(
        (s, o) =>
          s +
          o.lines
            .filter((l) => menu.find((m) => m.id === l.menuItemId)?.categoryId === c.id)
            .reduce((n, l) => n + l.qty, 0),
        0,
      ),
      amount: filtered.reduce(
        (s, o) =>
          s +
          o.lines
            .filter((l) => menu.find((m) => m.id === l.menuItemId)?.categoryId === c.id)
            .reduce((n, l) => n + l.qty * l.price, 0),
        0,
      ),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const byItem = Object.values(
    filtered
      .flatMap((o) => o.lines)
      .reduce<Record<string, { name: string; qty: number; amount: number }>>((acc, l) => {
        const key = `${l.menuItemId}-${l.variantName ?? ""}`;
        const name = l.variantName ? `${l.name} (${l.variantName})` : l.name;
        const prev = acc[key] ?? { name, qty: 0, amount: 0 };
        acc[key] = { name, qty: prev.qty + l.qty, amount: prev.amount + l.qty * l.price };
        return acc;
      }, {}),
  ).sort((a, b) => b.amount - a.amount);

  const expensesInRange = expenses.filter(
    (e) => e.spentAtBs >= fromBs && e.spentAtBs <= toBs,
  );
  const expensesTotal = expensesInRange.reduce((s, e) => s + e.amount, 0);
  const net = totalSales - expensesTotal;

  const stats = [
    { label: "Closed bills", value: String(filtered.filter((o) => o.status === "paid").length) },
    { label: "Items sold", value: String(filtered.reduce((s, o) => s + o.lines.reduce((n, l) => n + l.qty, 0), 0)) },
    { label: "Sales (gross)", value: NPR(totalSales) },
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
        <h2 className="truncate font-display text-2xl">Sales reports</h2>
        <p className="text-xs text-muted-foreground">Filter by date, status and order type</p>
      </div>

      <div className="pos-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label>From (BS)</Label>
          <BsDatePicker value={fromBs} onChange={setFromBs} />
        </div>
        <div className="space-y-2">
          <Label>To (BS)</Label>
          <BsDatePicker value={toBs} onChange={setToBs} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
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
          <Select value={type} onValueChange={setType}>
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

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 shrink-0 rounded-xl px-4 text-sm transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pos-card overflow-x-auto p-4 sm:p-5">
        {tab === "orders" && (
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
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border/70 align-top">
                  <td className="py-3 pr-3">#{o.billNumber}</td>
                  <td className="py-3 pr-3">{label(o)}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {formatDateWithStoredBs(o.placedAt, o.placedAtBs)}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {o.lines.map((l) => `${l.qty}× ${l.name}${l.variantName ? ` (${l.variantName})` : ""}`).join(", ")}
                  </td>
                  <td className="py-3 pr-3">{o.status === "paid" ? "Closed" : "Running"}</td>
                  <td className="py-3 text-right font-semibold">
                    {NPR(billTotals(o, settings.vatEnabled, settings.vatRate).total)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No orders match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab !== "orders" && (
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3">{tab === "category" ? "Category" : "Item"}</th>
                <th className="py-3 pr-3">Qty</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(tab === "category" ? byCategory : byItem).map((r) => (
                <tr key={r.name} className="border-b border-border/70">
                  <td className="py-3 pr-3">{r.name}</td>
                  <td className="py-3 pr-3 text-muted-foreground">{r.qty}</td>
                  <td className="py-3 text-right font-semibold">{NPR(r.amount)}</td>
                </tr>
              ))}
              {(tab === "category" ? byCategory : byItem).length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nothing sold in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
