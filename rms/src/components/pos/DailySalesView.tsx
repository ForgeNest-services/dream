import { useState } from "react";
import { Label } from "@/components/ui/label";
import { NPR } from "@/lib/pos/data";
import { billTotals, usePos } from "@/lib/pos/store";
import { toBsIso } from "@/lib/pos/nepali-date";
import { BsDatePicker } from "./BsDatePicker";

// Filter operates on placed_at_bs (backend-stamped BS string, "YYYY-MM-DD")
// which sorts lexically — matches the filter comparisons directly, no
// Gregorian conversion needed.
export function DailySalesView() {
  const { orders, expenses, settings, categories, menu } = usePos();
  const todayBs = toBsIso(new Date()) ?? "";
  const [fromBs, setFromBs] = useState(todayBs);
  const [toBs, setToBs] = useState(todayBs);

  const inRange = orders.filter(
    (o) => o.placedAtBs >= fromBs && o.placedAtBs <= toBs,
  );
  const paid = inRange.filter((o) => o.status === "paid");
  const sales = paid.reduce((s, o) => s + billTotals(o, settings.vatEnabled, settings.vatRate).total, 0);
  const items = inRange.reduce((s, o) => s + o.lines.reduce((n, l) => n + l.qty, 0), 0);

  // Expenses filter uses the same BS range so the P&L view matches.
  const expensesInRange = expenses.filter(
    (e) => e.spentAtBs >= fromBs && e.spentAtBs <= toBs,
  );
  const expensesTotal = expensesInRange.reduce((s, e) => s + e.amount, 0);
  const net = sales - expensesTotal;

  const byCategory = categories
    .map((c) => {
      const amount = inRange.reduce(
        (s, o) =>
          s +
          o.lines
            .filter((l) => menu.find((m) => m.id === l.menuItemId)?.categoryId === c.id)
            .reduce((n, l) => n + l.qty * l.price, 0),
        0,
      );
      return { name: c.name, amount };
    })
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const stats = [
    { label: "Orders closed", value: String(paid.length) },
    { label: "Items sold", value: String(items) },
    { label: "Sales (gross)", value: NPR(sales) },
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

      {expensesInRange.length > 0 && (
        <div className="pos-card p-4">
          <h3 className="font-display text-lg">Expenses breakdown</h3>
          <ul className="mt-3 space-y-2">
            {expensesInRange
              .reduce<{ category: string; amount: number }[]>((acc, e) => {
                const row = acc.find((r) => r.category === e.category);
                if (row) row.amount += e.amount;
                else acc.push({ category: e.category, amount: e.amount });
                return acc;
              }, [])
              .sort((a, b) => b.amount - a.amount)
              .map((c) => (
                <li
                  key={c.category}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">{c.category}</span>
                  <span className="shrink-0 font-medium">{NPR(c.amount)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="pos-card p-4">
        <h3 className="font-display text-lg">Category breakdown</h3>
        <ul className="mt-3 space-y-2">
          {byCategory.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{c.name}</span>
              <span className="shrink-0 font-medium">{NPR(c.amount)}</span>
            </li>
          ))}
          {byCategory.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              No orders in this date range yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
