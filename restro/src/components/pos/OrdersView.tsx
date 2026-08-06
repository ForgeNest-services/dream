import { useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NPR, type Order, type RestaurantTable } from "@/lib/pos/data";
import { billTotals, usePos } from "@/lib/pos/store";
import { OrderScreen } from "./OrderScreen";
import { ReserveDialog, TableGrid } from "./TableGrid";
import { BillReceipt, PrintDialog } from "./ThermalPrint";

type Tab = "take" | "bills";

export function OrdersView({ showControls = false }: { showControls?: boolean }) {
  const { tables } = usePos();
  const [tab, setTab] = useState<Tab>("take");
  const [table, setTable] = useState<RestaurantTable | null>(null);
  const live = table ? (tables.find((t) => t.id === table.id) ?? table) : null;

  if (live) return <OrderScreen table={live} onBack={() => setTable(null)} />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">Orders</h2>
          <p className="text-xs text-muted-foreground">Pick a table to start · view every bill</p>
        </div>
        <ReserveDialog />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: "take" as Tab, label: "Take order" },
            { id: "bills" as Tab, label: "Bills" },
          ]
        ).map((t) => (
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

      {tab === "take" ? (
        <TableGrid onOpen={setTable} showControls={showControls} />
      ) : (
        <BillsTable onOpen={(t) => setTable(t)} />
      )}
    </div>
  );
}

const fmt = (ts: number) =>
  new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function BillsTable({ onOpen }: { onOpen: (t: RestaurantTable) => void }) {
  const { orders, tables, settings } = usePos();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "paid">("all");
  const [print, setPrint] = useState<Order | null>(null);

  const label = (o: Order) =>
    o.type === "delivery"
      ? (o.delivery?.customerName ?? "Delivery")
      : (tables.find((t) => t.id === o.tableId)?.label ?? "Walk-in");

  const rows = useMemo(
    () =>
      orders
        .filter((o) => (filter === "all" ? true : o.status === filter))
        .filter((o) =>
          q.trim()
            ? `${o.id} ${label(o)}`.toLowerCase().includes(q.trim().toLowerCase())
            : true,
        )
        .sort((a, b) => b.placedAt - a.placedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, filter, q, tables],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-9"
            placeholder="Search bill number or table"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "draft", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`min-h-12 flex-1 rounded-xl px-4 text-sm capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}
            >
              {f === "draft" ? "Active" : f === "paid" ? "Settled" : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="pos-card overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-3 pr-3">Bill no.</th>
              <th className="py-3 pr-3">Table</th>
              <th className="py-3 pr-3">Date</th>
              <th className="py-3 pr-3">Status</th>
              <th className="py-3 pr-3">Total</th>
              <th className="py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const table = tables.find((t) => t.id === o.tableId);
              return (
                <tr key={o.id} className="border-b border-border/70">
                  <td className="py-3 pr-3">#{o.id.slice(-4).toUpperCase()}</td>
                  <td className="py-3 pr-3">{label(o)}</td>
                  <td className="py-3 pr-3 text-muted-foreground">{fmt(o.placedAt)}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-xs ${
                        o.status === "paid" ? "bg-secondary text-foreground" : "bg-primary/15 text-primary"
                      }`}
                    >
                      {o.status === "paid" ? "Settled" : "Active"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-semibold">
                    {NPR(billTotals(o, settings.vatEnabled, settings.vatRate).total)}
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      {o.status === "draft" && table && (
                        <Button variant="outline" className="h-10" onClick={() => onOpen(table)}>
                          Open
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10"
                        aria-label={`Print bill ${o.id}`}
                        onClick={() => setPrint(o)}
                      >
                        <Printer className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  No bills yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {print && (
        <PrintDialog open onOpenChange={(o) => !o && setPrint(null)} title="Print Bill">
          <BillReceipt
            order={print}
            tableLabel={label(print)}
            settings={settings}
            totals={billTotals(print, settings.vatEnabled, settings.vatRate)}
          />
        </PrintDialog>
      )}
    </div>
  );
}
