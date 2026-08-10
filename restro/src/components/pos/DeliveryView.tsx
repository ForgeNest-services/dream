import { useState } from "react";
import { Bike, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DELIVERY_STATUS_LABEL,
  NPR,
  type DeliveryStatus,
} from "@/lib/pos/data";
import { billTotals, usePos } from "@/lib/pos/store";
import { formatDateWithStoredBs } from "@/lib/pos/nepali-date";

const STATUS_ORDER: DeliveryStatus[] = ["pending", "out", "delivered"];

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  pending: "bg-warning text-navy",
  out: "bg-primary text-primary-foreground",
  delivered: "bg-success text-success-foreground",
};

export function DeliveryView() {
  const { orders, setDeliveryStatus, settings } = usePos();
  const [filter, setFilter] = useState<"all" | DeliveryStatus>("all");

  const list = orders
    .filter((o) => o.type === "delivery" && o.delivery)
    .filter((o) => filter === "all" || o.delivery!.status === filter)
    .sort((a, b) => b.placedAt - a.placedAt);

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h2 className="truncate font-display text-2xl">Delivery orders</h2>
        <p className="text-xs text-muted-foreground">Track and update delivery progress</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="h-11 w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" className="h-9 shrink-0 px-3 text-xs sm:text-sm">
            All
          </TabsTrigger>
          {STATUS_ORDER.map((s) => (
            <TabsTrigger key={s} value={s} className="h-9 shrink-0 px-3 text-xs sm:text-sm">
              {DELIVERY_STATUS_LABEL[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {list.map((o) => {
          const totals = billTotals(o, settings.vatEnabled, settings.vatRate);
          const d = o.delivery!;
          return (
            <article key={o.id} className="pos-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.customerName}</p>
                  <a
                    href={`tel:${d.phone}`}
                    className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <Phone className="size-3.5 shrink-0" />
                    {d.phone}
                  </a>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${STATUS_STYLE[d.status]}`}>
                  {DELIVERY_STATUS_LABEL[d.status]}
                </span>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">{d.address}</p>

              <ul className="mt-3 space-y-1 rounded-xl bg-secondary p-3 text-sm">
                {o.lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {l.qty} × {l.name}
                      {l.variantName ? ` (${l.variantName})` : ""}
                    </span>
                    <span className="shrink-0">{NPR(l.qty * l.price)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {formatDateWithStoredBs(o.placedAt, o.placedAtBs)}
                </span>
                <span className="shrink-0 font-display text-lg font-semibold text-primary">{NPR(totals.total)}</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {STATUS_ORDER.map((s) => (
                  <Button
                    key={s}
                    variant={d.status === s ? "default" : "outline"}
                    className="min-h-11 px-1 text-xs"
                    onClick={() => setDeliveryStatus(o.id, s)}
                  >
                    {DELIVERY_STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>
            </article>
          );
        })}
        {list.length === 0 && (
          <p className="pos-card flex items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Bike className="size-4" />
            No delivery orders here.
          </p>
        )}
      </div>
    </div>
  );
}
