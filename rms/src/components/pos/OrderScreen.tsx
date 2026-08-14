import { useState } from "react";
import { ArrowLeft, ChevronUp, Minus, Plus, Printer, Receipt, Send, Trash2, Wallet } from "lucide-react";
import placeholder from "@/assets/menu-placeholder.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, X as XIcon } from "lucide-react";
import { NPR, type MenuItem, type Order, type OrderCustomerRef, type RestaurantTable } from "@/lib/pos/data";
import { useBillTotals, usePos } from "@/lib/pos/store";
import { BillReceipt, KotReceipt, PrintDialog } from "./ThermalPrint";
import { CustomerPicker } from "./CustomerPicker";

// Frontend-only pseudo-category. "All" shows every menu item across every
// real category — never sent to the backend.
const ALL_CATEGORY = "__all__";

// The order-taking screen works identically for a dine-in table and for a
// delivery order — same menu grid, same running bill, same print + pay UX.
// The only differences are: how the current order is looked up, how new
// lines are added, and what label the header shows. Discriminated prop
// keeps the branch minimal.
export type OrderScreenProps =
  | { mode: "dine-in"; table: RestaurantTable; onBack: () => void }
  | { mode: "delivery"; orderId: string; onBack: () => void };

export function OrderScreen(props: OrderScreenProps) {
  const {
    categories,
    menu,
    orderForTable,
    orderById,
    addLine,
    addLineToOrder,
    sendToKitchen,
    markPaid,
    setOrderCustomer,
    settings,
    mergedGroup,
  } = usePos();

  const [activeCat, setActiveCat] = useState<string>(ALL_CATEGORY);
  const [variantItem, setVariantItem] = useState<MenuItem | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [kotOpen, setKotOpen] = useState(false);
  const [printBillOpen, setPrintBillOpen] = useState(false);
  const [method, setMethod] = useState<"cash" | "qr" | "khata">("cash");
  // For khata payments the caller must attach a customer. Cleared each time
  // the dialog re-opens. Delivery orders already have a customer attached
  // from creation — in that case we skip the picker entirely and reuse it.
  const [khataCustomerId, setKhataCustomerId] = useState<string | null>(null);

  const order =
    props.mode === "dine-in" ? orderForTable(props.table.id) : orderById(props.orderId);
  const totals = useBillTotals(order, settings.vatEnabled, settings.vatRate);
  const unsent = order?.lines.filter((l) => !l.sent).length ?? 0;
  const qty = order?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;
  const items =
    activeCat === ALL_CATEGORY ? menu : menu.filter((m) => m.categoryId === activeCat);
  const tableLabel =
    props.mode === "dine-in" ? mergedGroup(props.table).map((t) => t.label).join(" + ") : "";
  // Dine-in: header shows table label; if a customer has been attached
  // (typically for a khata order), append their name — matches delivery's
  // "Delivery · Name" style.
  const headerLabel =
    props.mode === "dine-in"
      ? order?.customer
        ? `${tableLabel} / ${order.customer.name}`
        : tableLabel
      : order?.customer
        ? `Delivery · ${order.customer.name}`
        : "Delivery";
  const subLabel =
    props.mode === "dine-in"
      ? order?.lines.length
        ? "Draft order"
        : "New order"
      : order?.customer?.phone || "New delivery";

  const add = (item: MenuItem, variantName?: string, price?: number) => {
    const line = {
      menuItemId: item.id,
      name: item.name,
      ...(variantName ? { variantName } : {}),
      price: price ?? item.price ?? 0,
      qty: 1,
      note: "",
    };
    if (props.mode === "dine-in") return addLine(props.table.id, line);
    return addLineToOrder(props.orderId, line);
  };

  const billPanel = (
    <BillPanel
      order={order}
      totals={totals}
      unsent={unsent}
      onSend={() => order && sendToKitchen(order.id)}
      onPrintKot={() => setKotOpen(true)}
      onPrintBill={() => setPrintBillOpen(true)}
      onPay={() => setPayOpen(true)}
    />
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-3 pb-24 xl:pb-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            onClick={props.onBack}
            aria-label={props.mode === "dine-in" ? "Back to tables" : "Back to deliveries"}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl leading-tight">{headerLabel}</h2>
            <p className="truncate text-xs text-muted-foreground">{subLabel}</p>
          </div>
          {/* Attach-customer chip, only for dine-in. Delivery orders always
              have a customer from creation, no need. */}
          {props.mode === "dine-in" && order && (
            order.customer ? (
              <button
                type="button"
                onClick={() => order && setOrderCustomer(order.id, null)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                aria-label={`Detach ${order.customer.name}`}
                title="Detach customer"
              >
                <span className="max-w-24 truncate">{order.customer.name}</span>
                <XIcon className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCustomerPickerOpen(true)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                <UserPlus className="size-3.5" />
                Attach customer
              </button>
            )
          )}
        </div>

        <Tabs value={activeCat} onValueChange={setActiveCat}>
          <TabsList className="h-11 w-full justify-start overflow-x-auto">
            <TabsTrigger
              value={ALL_CATEGORY}
              className="h-9 shrink-0 px-3 text-xs sm:text-sm"
            >
              All
            </TabsTrigger>
            {categories.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="h-9 shrink-0 px-3 text-xs sm:text-sm">
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {items.map((item) => (
            <button
              key={item.id}
              disabled={item.soldOut}
              onClick={() => (item.hasVariants ? setVariantItem(item) : add(item))}
              className={`pos-card flex flex-col overflow-hidden text-left transition-transform active:scale-[0.98] ${
                item.soldOut ? "cursor-not-allowed opacity-45 grayscale" : "hover:border-primary"
              }`}
            >
              <div className="flex h-32 w-full items-center justify-center bg-secondary sm:h-36 md:h-40">
                <img
                  src={item.image || placeholder}
                  alt={item.name}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex-1 p-2">
                <p className="line-clamp-2 text-xs font-medium leading-tight sm:text-sm">
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-primary sm:text-sm">
                  {item.hasVariants ? `${item.variants.length} options` : NPR(item.price ?? 0)}
                </p>
                {item.soldOut && (
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-danger">Sold out</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Desktop side panel */}
      <aside className="pos-card hidden h-fit flex-col p-4 xl:sticky xl:top-24 xl:flex">
        <h3 className="font-display text-lg">Running bill</h3>
        <p className="truncate text-xs text-muted-foreground">
          {headerLabel} · {order?.lines.length ?? 0} line(s)
        </p>
        {billPanel}
      </aside>

      {/* Mobile persistent summary bar + bottom sheet */}
      <Drawer open={billOpen} onOpenChange={setBillOpen}>
        <DrawerTrigger asChild>
          <button className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-navy-soft/40 bg-navy px-4 py-3 text-navy-foreground xl:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <Receipt className="size-5 shrink-0" />
              <span className="truncate text-sm">{qty} item{qty === 1 ? "" : "s"} · {headerLabel}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-display text-lg">{NPR(totals.total)}</span>
              <ChevronUp className="size-5" />
            </span>
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="truncate font-display text-lg">Running bill · {headerLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{billPanel}</div>
        </DrawerContent>
      </Drawer>

      <Dialog open={!!variantItem} onOpenChange={(o) => !o && setVariantItem(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Choose variant · {variantItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {variantItem?.variants.map((v) => (
              <Button
                key={v.id}
                variant="outline"
                className="h-14 justify-between text-base"
                onClick={() => {
                  add(variantItem, v.name, v.price);
                  setVariantItem(null);
                }}
              >
                {v.name}
                <span className="text-primary">{NPR(v.price)}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={payOpen}
        onOpenChange={(o) => {
          setPayOpen(o);
          if (!o) {
            setMethod("cash");
            setKhataCustomerId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Payment · {NPR(totals.total)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(["cash", "qr", "khata"] as const).map((m) => (
              <Button
                key={m}
                variant={method === m ? "default" : "outline"}
                className="h-14 text-sm uppercase"
                onClick={() => {
                  setMethod(m);
                  if (m !== "khata") setKhataCustomerId(null);
                }}
              >
                {m}
              </Button>
            ))}
          </div>
          {method === "qr" && (
            <div className="grid place-items-center rounded-xl bg-secondary p-4">
              {settings.qrImage ? (
                <img src={settings.qrImage} alt="Payment QR" className="size-40 object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">No QR uploaded in Settings yet.</p>
              )}
            </div>
          )}
          {method === "khata" && (
            <KhataCustomerStep
              existingCustomer={order?.customer ?? null}
              pickedId={khataCustomerId}
              onPick={(id) => setKhataCustomerId(id)}
              onClear={() => setKhataCustomerId(null)}
              totalAmount={totals.total}
            />
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => setPrintBillOpen(true)}
            >
              <Printer className="size-4" />
              Print Bill
            </Button>
            <Button
              className="h-12 w-full"
              disabled={
                method === "khata" && !khataCustomerId && !order?.customer
              }
              onClick={() => {
                if (!order) return;
                // For khata: prefer the just-picked customer, but fall back
                // to whatever's attached to the order (delivery flow).
                const cid =
                  method === "khata"
                    ? khataCustomerId ?? order.customer?.id ?? undefined
                    : undefined;
                markPaid(order.id, method, cid);
                setPayOpen(false);
                setMethod("cash");
                setKhataCustomerId(null);
                props.onBack();
              }}
            >
              {method === "khata" ? "Add to Khata" : "Confirm payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Attach customer to order</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Tag this table's bill to a customer — the header shows their name and marking paid as
            Khata will use them automatically.
          </p>
          <CustomerPicker
            onPick={async (c) => {
              if (order) await setOrderCustomer(order.id, c.id);
              setCustomerPickerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {order && (
        <>
          <PrintDialog open={kotOpen} onOpenChange={setKotOpen} title="Print KOT">
            <KotReceipt order={order} tableLabel={headerLabel} settings={settings} />
          </PrintDialog>
          <PrintDialog open={printBillOpen} onOpenChange={setPrintBillOpen} title="Print Bill">
            <BillReceipt order={order} tableLabel={headerLabel} settings={settings} totals={totals} />
          </PrintDialog>
        </>
      )}
    </div>
  );
}

// Sub-step shown inside the payment dialog when the waiter picks "khata".
// If the order already has a customer attached (delivery flow), we just
// show a confirmation card. Otherwise we show the CustomerPicker.
function KhataCustomerStep({
  existingCustomer,
  pickedId,
  onPick,
  onClear,
  totalAmount,
}: {
  existingCustomer: OrderCustomerRef | null;
  pickedId: string | null;
  onPick: (id: string) => void;
  onClear: () => void;
  totalAmount: number;
}) {
  const { customers } = usePos();
  const pickedCustomer = pickedId ? customers.find((c) => c.id === pickedId) : null;
  const displayCustomer = pickedCustomer ?? existingCustomer;

  if (displayCustomer) {
    return (
      <div className="rounded-xl border-2 border-primary bg-primary/5 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
          Adding {NPR(totalAmount)} to khata
        </p>
        <p className="mt-1 truncate font-medium">{displayCustomer.name}</p>
        {displayCustomer.phone && (
          <p className="truncate text-xs text-muted-foreground">{displayCustomer.phone}</p>
        )}
        {pickedCustomer && (
          <button
            type="button"
            onClick={onClear}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Pick a different customer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Pick the customer taking this on tab, or add a new one.
      </p>
      <CustomerPicker onPick={(c) => onPick(c.id)} autoFocus={false} />
    </div>
  );
}

function BillPanel({
  order,
  totals,
  unsent,
  onSend,
  onPrintKot,
  onPrintBill,
  onPay,
}: {
  order: Order | undefined;
  totals: { subtotal: number; discount: number; vat: number; total: number };
  unsent: number;
  onSend: () => void;
  onPrintKot: () => void;
  onPrintBill: () => void;
  onPay: () => void;
}) {
  const { updateLine, removeLine, setDiscount, settings } = usePos();

  return (
    <div>
      <ul className="mt-3 max-h-[38vh] space-y-2 overflow-y-auto pr-1">
        {order?.lines.map((line) => (
          <li key={line.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {line.name}
                  {line.variantName ? ` · ${line.variantName}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {NPR(line.price)} each {line.sent && "· sent"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium">{NPR(line.price * line.qty)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                aria-label="Decrease quantity"
                onClick={() =>
                  line.qty > 1
                    ? updateLine(order.id, line.id, { qty: line.qty - 1 })
                    : removeLine(order.id, line.id)
                }
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-7 text-center font-display text-lg">{line.qty}</span>
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                aria-label="Increase quantity"
                onClick={() => updateLine(order.id, line.id, { qty: line.qty + 1 })}
              >
                <Plus className="size-4" />
              </Button>
              <Input
                className="h-10 min-w-0"
                placeholder="Note e.g. no onion"
                value={line.note}
                onChange={(e) => updateLine(order.id, line.id, { note: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 text-danger"
                aria-label="Remove line"
                onClick={() => removeLine(order.id, line.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
        {!order?.lines.length && (
          <li className="rounded-xl bg-secondary p-6 text-center text-sm text-muted-foreground">
            Tap menu items to start the bill.
          </li>
        )}
      </ul>

      {order && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs uppercase">Discount</Label>
            <Input
              type="number"
              inputMode="numeric"
              className="h-11"
              value={order.discountValue}
              onChange={(e) => setDiscount(order.id, order.discountType, Number(e.target.value))}
            />
            <Button
              variant="outline"
              className="h-11 w-14 shrink-0"
              onClick={() =>
                setDiscount(
                  order.id,
                  order.discountType === "percent" ? "flat" : "percent",
                  order.discountValue,
                )
              }
            >
              {order.discountType === "percent" ? "%" : "Rs"}
            </Button>
          </div>

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{NPR(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="text-danger">-{NPR(totals.discount)}</dd>
              </div>
            )}
            {settings.vatEnabled && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">VAT ({settings.vatRate}%)</dt>
                <dd>{NPR(totals.vat)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-2">
              <dt className="font-display text-base font-semibold">Total</dt>
              <dd className="font-display text-lg font-semibold text-primary">{NPR(totals.total)}</dd>
            </div>
          </dl>

          <Button className="h-13 min-h-12 w-full" disabled={unsent === 0} onClick={onSend}>
            <Send className="size-5" />
            Send to Kitchen{unsent ? ` (${unsent} new)` : ""}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="min-h-12"
              disabled={!order.lines.length}
              onClick={onPrintKot}
            >
              <Printer className="size-4" />
              Print KOT
            </Button>
            <Button
              variant="outline"
              className="min-h-12"
              disabled={!order.lines.length}
              onClick={onPrintBill}
            >
              <Receipt className="size-4" />
              Print Bill
            </Button>
          </div>
          <Button
            variant="outline"
            className="min-h-12 w-full border-2 border-success text-success hover:bg-success hover:text-success-foreground"
            disabled={!order.lines.length}
            onClick={onPay}
          >
            <Wallet className="size-5" />
            Mark as Paid
          </Button>
        </div>
      )}
    </div>
  );
}
