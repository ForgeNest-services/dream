import { useState } from "react";
import { Bike, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DELIVERY_STATUS_LABEL,
  NPR,
  type DeliveryStatus,
} from "@/lib/pos/data";
import { billTotals, usePos } from "@/lib/pos/store";
import { formatDateWithStoredBs } from "@/lib/pos/nepali-date";
import { OrderScreen } from "./OrderScreen";
import { CustomerPicker } from "./CustomerPicker";

const STATUS_ORDER: DeliveryStatus[] = ["pending", "out", "delivered"];

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  pending: "bg-warning text-navy",
  out: "bg-primary text-primary-foreground",
  delivered: "bg-success text-success-foreground",
};

export function DeliveryView() {
  const { orders, setDeliveryStatus, settings, createDeliveryOrder } = usePos();
  const [filter, setFilter] = useState<"all" | DeliveryStatus>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  // When set, we render the same order-taking screen used for dine-in,
  // scoped to this delivery order id. Back returns to the list.
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);

  if (draftOrderId) {
    return (
      <OrderScreen
        mode="delivery"
        orderId={draftOrderId}
        onBack={() => setDraftOrderId(null)}
      />
    );
  }

  const list = orders
    .filter((o) => o.type === "delivery" && o.customer)
    .filter((o) => filter === "all" || o.deliveryStatus === filter)
    .sort((a, b) => b.placedAt - a.placedAt);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">Delivery orders</h2>
          <p className="text-xs text-muted-foreground">Track and update delivery progress</p>
        </div>
        <Button size="lg" className="h-12 shrink-0" onClick={() => setPickerOpen(true)}>
          <Plus className="size-5" />
          New delivery
        </Button>
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
          const c = o.customer!;
          const status = o.deliveryStatus ?? "pending";
          const isKhata = o.paymentMethod === "khata";
          return (
            <article key={o.id} className="pos-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <Phone className="size-3.5 shrink-0" />
                      {c.phone}
                    </a>
                  )}
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${STATUS_STYLE[status]}`}>
                  {DELIVERY_STATUS_LABEL[status]}
                </span>
              </div>

              {c.address && <p className="mt-2 text-sm text-muted-foreground">{c.address}</p>}

              {o.lines.length > 0 && (
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
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {formatDateWithStoredBs(o.placedAt, o.placedAtBs)}
                </span>
                <span className="shrink-0 font-display text-lg font-semibold text-primary">
                  {NPR(totals.total)}
                  {isKhata && (
                    <span className="ml-1.5 rounded-md bg-warning px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy">
                      Khata
                    </span>
                  )}
                </span>
              </div>

              {/* Status pillbar is always available — the delivery guy can
                  be on-the-way before the customer pays (COD is the norm). */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {STATUS_ORDER.map((s) => (
                  <Button
                    key={s}
                    variant={status === s ? "default" : "outline"}
                    className="min-h-11 px-1 text-xs"
                    onClick={() => setDeliveryStatus(o.id, s)}
                  >
                    {DELIVERY_STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>

              {o.status === "draft" && (
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setDraftOrderId(o.id)}
                >
                  Continue order · add items / mark paid
                </Button>
              )}
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

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">New delivery</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Pick the customer this delivery is for, or add a new one. After you continue you'll
            pick items — send-to-kitchen and mark-paid work the same as a dine-in order.
          </p>
          <CustomerPicker
            onPick={async (customer) => {
              const id = await createDeliveryOrder(customer.id);
              if (id) {
                setPickerOpen(false);
                setDraftOrderId(id);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
