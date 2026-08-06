import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NPR, type Order, type Settings } from "@/lib/pos/data";
import { formatBikramSambat } from "@/lib/pos/nepali-date";

function Divider() {
  return <div className="my-1 border-t border-dashed border-black" />;
}

export function KotReceipt({
  order,
  tableLabel,
  settings,
}: {
  order: Order;
  tableLabel: string;
  settings: Settings;
}) {
  const now = new Date();
  return (
    <div className="thermal-receipt mx-auto p-2">
      <p className="text-center text-[13px] uppercase tracking-widest">Kitchen Order Ticket</p>
      <p className="text-center">{settings.restaurantName}</p>
      <Divider />
      <p>Table : {tableLabel}</p>
      <p>Order : #{order.id.slice(0, 6).toUpperCase()}</p>
      <p>Waiter: {order.waiter}</p>
      <p>
        Time : {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
        {formatBikramSambat(now)}
      </p>
      <Divider />
      <p>QTY ITEM</p>
      <Divider />
      {order.lines.map((l) => (
        <div key={l.id} className="mb-1">
          <p>
            {String(l.qty).padEnd(3, " ")}
            {l.name}
            {l.variantName ? ` (${l.variantName})` : ""}
          </p>
          {l.note && <p className="pl-6">* {l.note}</p>}
        </div>
      ))}
      <Divider />
      <p className="text-center">-- END OF TICKET --</p>
    </div>
  );
}

export function BillReceipt({
  order,
  tableLabel,
  settings,
  totals,
}: {
  order: Order;
  tableLabel: string;
  settings: Settings;
  totals: { subtotal: number; discount: number; vat: number; total: number };
}) {
  const now = new Date();
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
  return (
    <div className="thermal-receipt mx-auto p-2">
      <p className="text-center text-[13px] uppercase tracking-widest">{settings.restaurantName}</p>
      <p className="text-center">{settings.branchAddress}</p>
      <p className="text-center">Tel: {settings.branchPhone}</p>
      <Divider />
      <p>Bill  : #{order.id.slice(0, 6).toUpperCase()}</p>
      <p>Table : {tableLabel}</p>
      <p>Staff : {order.waiter}</p>
      <p>Date : {formatBikramSambat(now)}</p>
      <p>Time : {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      <Divider />
      {order.lines.map((l) => (
        <div key={l.id} className="mb-1">
          <p>
            {l.name}
            {l.variantName ? ` (${l.variantName})` : ""}
          </p>
          {row(`  ${l.qty} x ${l.price}`, NPR(l.qty * l.price))}
        </div>
      ))}
      <Divider />
      {row("Subtotal", NPR(totals.subtotal))}
      {totals.discount > 0 && row("Discount", `-${NPR(totals.discount)}`)}
      {settings.vatEnabled && row(`VAT ${settings.vatRate}%`, NPR(totals.vat))}
      <Divider />
      <div className="flex justify-between text-[13px]">
        <span>TOTAL</span>
        <span>{NPR(totals.total)}</span>
      </div>
      <Divider />
      <p>Payment: {(order.paymentMethod ?? "pending").toUpperCase()}</p>
      {settings.qrImage && (
        <img src={settings.qrImage} alt="Payment QR" className="mx-auto mt-2 size-24 object-contain" />
      )}
      <p className="mt-2 text-center">Thank you · Pheri aaunuhola!</p>
    </div>
  );
}

export function PrintDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Preview at 70mm thermal width. Tap print to send to the receipt printer.
        </p>
        <div className="rounded-xl border border-border bg-white p-2">
          <div id="thermal-print-area">{children}</div>
        </div>
        <DialogFooter>
          <Button size="lg" className="h-12 w-full" onClick={() => window.print()}>
            <Printer className="size-5" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
