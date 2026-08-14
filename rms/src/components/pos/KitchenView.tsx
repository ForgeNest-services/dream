import { useEffect, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KitchenStatus, Order } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

const COLUMNS: { id: KitchenStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "cooking", label: "Cooking" },
  { id: "ready", label: "Ready" },
  { id: "served", label: "Served" },
];

const NEXT: Record<KitchenStatus, KitchenStatus | null> = {
  new: "cooking",
  cooking: "ready",
  ready: "served",
  served: null,
};

function elapsedStyle(mins: number) {
  if (mins >= 20) return "border-danger bg-danger/10 text-danger";
  if (mins >= 10) return "border-warning bg-warning/15 text-navy";
  return "border-success bg-success/10 text-success";
}

export function KitchenView() {
  const { orders, tables, setKitchenStatus } = usePos();
  const [now, setNow] = useState(Date.now());
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Kitchen board shows only OPEN bills that have at least one sent line.
  // Once an order is marked paid (or cancelled), it disappears from the
  // board — even if chef never touched kitchen_status. Some restaurants
  // don't use the board at all (printed KOT only), so we must not require
  // manual advancement to clean things up. Backend also auto-sets
  // kitchen_status='served' on mark_paid, so reports stay honest.
  const live = orders.filter(
    (o) => o.status === "draft" && o.lines.some((l) => l.sent),
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">Kitchen Display</h2>
        <p className="text-sm text-muted-foreground">
          Drag a ticket between columns, or tap the arrow to advance it.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = live.filter((o) => o.kitchenStatus === col.id);
          return (
            <section
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) setKitchenStatus(dragId, col.id);
                setDragId(null);
              }}
              className="flex min-h-64 flex-col rounded-2xl bg-navy p-3 text-navy-foreground"
            >
              <div className="flex items-center justify-between px-1 pb-3">
                <h3 className="font-display text-lg">{col.label}</h3>
                <span className="rounded-md bg-navy-soft px-2 py-1 text-xs font-medium">{cards.length}</span>
              </div>
              <div className="flex-1 space-y-3">
                {cards.map((order) => (
                  <Ticket
                    key={order.id}
                    order={order}
                    tableLabel={order.type === "delivery" ? "Delivery" : (tables.find((t) => t.id === order.tableId)?.label ?? "—")}
                    now={now}
                    onDragStart={() => setDragId(order.id)}
                    onAdvance={() => {
                      const next = NEXT[order.kitchenStatus];
                      if (next) setKitchenStatus(order.id, next);
                    }}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="rounded-xl border border-dashed border-navy-soft p-6 text-center text-xs text-navy-foreground/50">
                    No tickets
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Ticket({
  order,
  tableLabel,
  now,
  onDragStart,
  onAdvance,
}: {
  order: Order;
  tableLabel: string;
  now: number;
  onDragStart: () => void;
  onAdvance: () => void;
}) {
  const mins = Math.max(0, Math.floor((now - order.placedAt) / 60000));

  return (
    <article
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-xl bg-card p-3 text-card-foreground shadow-[var(--shadow-card)] active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-lg leading-none">{tableLabel}</span>
        <span
          className={`flex items-center gap-1 rounded-md border-2 px-2 py-1 text-xs font-medium ${elapsedStyle(mins)}`}
        >
          <Clock className="size-3.5" />
          {mins}m
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {order.lines
          .filter((l) => l.sent)
          .map((l) => (
            <li key={l.id} className="text-sm">
              <p className="font-medium">
                {l.qty}× {l.name}
                {l.variantName ? ` · ${l.variantName}` : ""}
              </p>
              {l.note && <p className="text-xs font-semibold text-primary">“{l.note}”</p>}
            </li>
          ))}
      </ul>
      {order.kitchenStatus !== "served" && (
        <Button size="sm" className="mt-3 h-11 w-full font-medium" onClick={onAdvance}>
          Advance
          <ChevronRight className="size-4" />
        </Button>
      )}
    </article>
  );
}
