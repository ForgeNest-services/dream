import { useState } from "react";
import { Bike, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DELIVERY_STATUS_LABEL,
  NPR,
  type DeliveryInfo,
  type DeliveryStatus,
} from "@/lib/pos/data";
import { billTotals, usePos } from "@/lib/pos/store";
import { formatDateWithStoredBs } from "@/lib/pos/nepali-date";
import { OrderScreen } from "./OrderScreen";

const STATUS_ORDER: DeliveryStatus[] = ["pending", "out", "delivered"];

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  pending: "bg-warning text-navy",
  out: "bg-primary text-primary-foreground",
  delivered: "bg-success text-success-foreground",
};

export function DeliveryView() {
  const { orders, setDeliveryStatus, settings, createDeliveryOrder } = usePos();
  const [filter, setFilter] = useState<"all" | DeliveryStatus>("all");
  const [customerOpen, setCustomerOpen] = useState(false);
  // When set, we render the same order-taking screen used for dine-in,
  // scoped to this delivery order id. Back returns to the list.
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);

  // If the user has an in-progress delivery draft, swap the whole view for
  // the order screen — mirrors how OrdersView swaps to OrderScreen when a
  // table is opened.
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
    .filter((o) => o.type === "delivery" && o.delivery)
    .filter((o) => filter === "all" || o.delivery!.status === filter)
    .sort((a, b) => b.placedAt - a.placedAt);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">Delivery orders</h2>
          <p className="text-xs text-muted-foreground">Track and update delivery progress</p>
        </div>
        <Button size="lg" className="h-12 shrink-0" onClick={() => setCustomerOpen(true)}>
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
                <span className="shrink-0 font-display text-lg font-semibold text-primary">{NPR(totals.total)}</span>
              </div>

              {o.status === "draft" ? (
                <Button
                  className="mt-3 w-full"
                  onClick={() => setDraftOrderId(o.id)}
                >
                  Continue order
                </Button>
              ) : (
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

      <NewDeliveryDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        onCreate={async (info) => {
          const id = await createDeliveryOrder(info);
          if (id) {
            setCustomerOpen(false);
            setDraftOrderId(id);
          }
        }}
      />
    </div>
  );
}

function NewDeliveryDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (info: DeliveryInfo) => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = customerName.trim() && phone.trim() && address.trim() && !isSubmitting;

  const reset = () => {
    setCustomerName("");
    setPhone("");
    setAddress("");
    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (isSubmitting) return;
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">New delivery</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Customer name</Label>
            <Input
              className="h-12"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              autoFocus
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              className="h-12"
              inputMode="tel"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label>Delivery address</Label>
            <Textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            After Continue you'll pick items — send to kitchen and mark paid work the
            same as a dine-in order. Delivery status becomes editable once the bill is closed.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-12" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="h-12"
            disabled={!canSubmit}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                await onCreate({
                  customerName: customerName.trim(),
                  phone: phone.trim(),
                  address: address.trim(),
                  status: "pending",
                });
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? "Starting…" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
