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
import { NPR, type MenuItem, type Order, type RestaurantTable } from "@/lib/pos/data";
import { useBillTotals, usePos } from "@/lib/pos/store";
import { BillReceipt, KotReceipt, PrintDialog } from "./ThermalPrint";

// Frontend-only pseudo-category. "All" shows every menu item across every
// real category — never sent to the backend.
const ALL_CATEGORY = "__all__";

export function OrderScreen({ table, onBack }: { table: RestaurantTable; onBack: () => void }) {
  const {
    categories,
    menu,
    orderForTable,
    addLine,
    sendToKitchen,
    markPaid,
    settings,
    mergedGroup,
  } = usePos();

  const [activeCat, setActiveCat] = useState<string>(ALL_CATEGORY);
  const [variantItem, setVariantItem] = useState<MenuItem | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [kotOpen, setKotOpen] = useState(false);
  const [printBillOpen, setPrintBillOpen] = useState(false);
  const [method, setMethod] = useState<"cash" | "qr" | "card">("cash");

  const order = orderForTable(table.id);
  const totals = useBillTotals(order, settings.vatEnabled, settings.vatRate);
  const unsent = order?.lines.filter((l) => !l.sent).length ?? 0;
  const qty = order?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;
  const items =
    activeCat === ALL_CATEGORY ? menu : menu.filter((m) => m.categoryId === activeCat);
  const tableLabel = mergedGroup(table).map((t) => t.label).join(" + ");

  const add = (item: MenuItem, variantName?: string, price?: number) =>
    addLine(table.id, {
      menuItemId: item.id,
      name: item.name,
      ...(variantName ? { variantName } : {}),
      price: price ?? item.price ?? 0,
      qty: 1,
      note: "",
    });

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
          <Button variant="outline" size="icon" className="size-11 shrink-0" onClick={onBack} aria-label="Back to tables">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl leading-tight">{tableLabel}</h2>
            <p className="text-xs text-muted-foreground">
              {order?.lines.length ? "Draft order" : "New order"}
            </p>
          </div>
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
        <p className="text-xs text-muted-foreground">
          {tableLabel} · {order?.lines.length ?? 0} line(s)
        </p>
        {billPanel}
      </aside>

      {/* Mobile persistent summary bar + bottom sheet */}
      <Drawer open={billOpen} onOpenChange={setBillOpen}>
        <DrawerTrigger asChild>
          <button className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-navy-soft/40 bg-navy px-4 py-3 text-navy-foreground xl:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <Receipt className="size-5 shrink-0" />
              <span className="truncate text-sm">{qty} item{qty === 1 ? "" : "s"} · {tableLabel}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-display text-lg">{NPR(totals.total)}</span>
              <ChevronUp className="size-5" />
            </span>
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="font-display text-lg">Running bill · {tableLabel}</DrawerTitle>
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

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Payment · {NPR(totals.total)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(["cash", "qr", "card"] as const).map((m) => (
              <Button
                key={m}
                variant={method === m ? "default" : "outline"}
                className="h-14 text-sm uppercase"
                onClick={() => setMethod(m)}
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
              onClick={() => {
                if (order) markPaid(order.id, method);
                setPayOpen(false);
                onBack();
              }}
            >
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {order && (
        <>
          <PrintDialog open={kotOpen} onOpenChange={setKotOpen} title="Print KOT">
            <KotReceipt order={order} tableLabel={tableLabel} settings={settings} />
          </PrintDialog>
          <PrintDialog open={printBillOpen} onOpenChange={setPrintBillOpen} title="Print Bill">
            <BillReceipt order={order} tableLabel={tableLabel} settings={settings} totals={totals} />
          </PrintDialog>
        </>
      )}
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
