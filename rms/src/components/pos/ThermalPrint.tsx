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
import type { TenantInfoDto } from "@/lib/tenant-api";
import { usePos } from "@/lib/pos/store";
import {
  formatBikramSambat,
  NEPALI_MONTHS,
  parseApiDate,
} from "@/lib/pos/nepali-date";

function Divider() {
  return <div className="my-1 border-t border-dashed border-black" />;
}

// Uses the persisted `order.placedAtBs` when available so the printed
// receipt matches the exact BS date the order was stamped with server-side.
// Falls back to converting `now` if a fresh (unsaved) order is ever printed.
function bsFromOrder(order: Order): string {
  if (!order.placedAtBs) return formatBikramSambat(new Date());
  const [y, m, d] = order.placedAtBs.split("-");
  const month = NEPALI_MONTHS[Number(m) - 1] ?? m;
  return `${month} ${Number(d)}, ${Number(y)} BS`;
}

// `order.placedAt` was parsed via parseApiDate (UTC), so this formats in
// NPT via toLocaleTimeString({ timeZone }).
function nptTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kathmandu",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function nptDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Header block used by both KOT and Bill — pulls PAN + VAT-registration
// status from the tenant, falls back gracefully if either is missing.
function TenantHeader({
  tenant,
  settings,
  showAddress,
}: {
  tenant: TenantInfoDto | null;
  settings: Settings;
  showAddress: boolean;
}) {
  const name = tenant?.name ?? settings.restaurantName;
  return (
    <>
      <p className="text-center text-[13px] uppercase tracking-widest">{name}</p>
      {showAddress && (
        <>
          {settings.branchAddress && <p className="text-center">{settings.branchAddress}</p>}
          {settings.branchPhone && <p className="text-center">Tel: {settings.branchPhone}</p>}
        </>
      )}
      {tenant?.pan && (
        <p className="text-center text-[11px]">
          {tenant.is_vat_registered ? "VAT No." : "PAN"}: {tenant.pan}
        </p>
      )}
    </>
  );
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
  const { tenant, menu } = usePos();
  const printedAt = Date.now();
  return (
    <div className="thermal-receipt mx-auto p-2">
      <p className="text-center text-[13px] uppercase tracking-widest">Kitchen Order Ticket</p>
      <TenantHeader tenant={tenant} settings={settings} showAddress={false} />
      <Divider />
      <p>Table : {tableLabel}</p>
      <p>Bill  : #{order.billNumber}</p>
      <p>
        Time : {nptTime(order.placedAt)} · {bsFromOrder(order)}
      </p>
      {printedAt - order.placedAt > 60_000 && (
        <p className="text-[10px] opacity-70">Printed: {nptTime(printedAt)}</p>
      )}
      <Divider />
      <p>QTY ITEM</p>
      <Divider />
      {order.lines.map((l) => {
        // If this line references a combo menu item, expand its components
        // as indented sub-lines. Multiplied by the order qty so ordering
        // 2× "Family Meal" shows "→ 4× Steam Momo (Chicken)" etc.
        const menuItem = l.menuItemId ? menu.find((m) => m.id === l.menuItemId) : null;
        const combo = menuItem?.isCombo ? menuItem : null;
        return (
          <div key={l.id} className="mb-1">
            <p>
              {String(l.qty).padEnd(3, " ")}
              {l.name}
              {l.variantName ? ` (${l.variantName})` : ""}
            </p>
            {combo &&
              combo.components.map((c) => (
                <p key={c.id} className="pl-6">
                  → {c.qty * l.qty}× {c.childName}
                  {c.childVariantName ? ` (${c.childVariantName})` : ""}
                </p>
              ))}
            {l.note && <p className="pl-6">* {l.note}</p>}
          </div>
        );
      })}
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
  const { tenant } = usePos();
  // Prefer the paid_at for closed bills, placed_at for drafts — matches what
  // the customer expects to see on the receipt (when THIS bill was closed).
  const displayTs =
    order.status === "paid" && order.paidAtBs ? order.placedAt : order.placedAt;
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
  const paymentLabel = order.paymentMethod
    ? order.paymentMethod === "khata"
      ? "KHATA (on tab)"
      : order.paymentMethod.toUpperCase()
    : "PENDING";
  return (
    <div className="thermal-receipt mx-auto p-2">
      <TenantHeader tenant={tenant} settings={settings} showAddress={true} />
      <Divider />
      <p>Bill  : #{order.billNumber}</p>
      <p>Table : {tableLabel}</p>
      {order.customer && (
        <>
          <p>Cust. : {order.customer.name}</p>
          {order.customer.phone && <p>Phone : {order.customer.phone}</p>}
        </>
      )}
      <p>Date : {bsFromOrder(order)}</p>
      <p>Also : {nptDate(displayTs)}</p>
      <p>Time : {nptTime(displayTs)}</p>
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
      {settings.vatEnabled && tenant?.is_vat_registered && (
        row(`VAT ${settings.vatRate}%`, NPR(totals.vat))
      )}
      <Divider />
      <div className="flex justify-between text-[13px]">
        <span>TOTAL</span>
        <span>{NPR(totals.total)}</span>
      </div>
      <Divider />
      <p>Payment: {paymentLabel}</p>
      {settings.qrImage && (
        <img src={settings.qrImage} alt="Payment QR" className="mx-auto mt-2 size-24 object-contain" />
      )}
      <p className="mt-2 text-center">Thank you · Pheri aaunuhola!</p>
      {/* Small "Powered By" branding at the very bottom. Kept tiny so it
          doesn't compete with the restaurant's own branding at the top. */}
      <div className="mt-2 flex flex-col items-center border-t border-dashed border-black pt-1.5">
        <p className="text-[9px] uppercase tracking-widest opacity-60">Powered By</p>
        <img
          src="/RMS.png"
          alt="Srota RMS"
          className="mt-0.5 h-5 w-auto opacity-80"
        />
      </div>
    </div>
  );
}
// parseApiDate re-exported here in case any consumer needs it, avoiding a
// circular import — actually it's already used above via order.placedAt (already parsed).
void parseApiDate;

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
