import { DatePicker } from "@/components/common/date-picker";
import { EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { MediaPicker, MediaThumb } from "@/components/inventory/media-picker";
import { CustomerDialog } from "@/components/parties/party-dialogs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import type { InvoiceLine } from "@/data/types";
import { computeTotals } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, QrCode, Search, Trash2, UserPlus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sales/pos")({
  head: () => ({
    meta: [
      { title: "Point of Sale — SROTA IMS" },
      {
        name: "description",
        content:
          "Fast counter terminal: scan or search products, build a cart, split payment across cash and QR, and print an IRD invoice.",
      },
      { property: "og:title", content: "Point of Sale — SROTA IMS" },
      {
        property: "og:description",
        content: "Counter sales terminal with barcode search, cart, cash/QR payment and printing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PosPage,
});

interface CartLine extends InvoiceLine {
  maxStock: number;
}

function PosPage() {
  const app = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [cash, setCash] = useState(0);
  const [qr, setQr] = useState(0);
  const [method, setMethod] = useState<"cash" | "qr" | "split">("cash");
  const [qrOpen, setQrOpen] = useState(false);
  const [date, setDate] = useState<string | null>(new Date().toISOString());
  const [custOpen, setCustOpen] = useState(false);

  const branchId = app.branchId === "all" ? (app.branches[0]?.id ?? "") : app.branchId;
  const customers = app.parties.filter((p) => p.kind === "customer");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return app.variants
      .filter((v) => {
        const p = app.products.find((x) => x.id === v.productId);
        if (!p) return false;
        return (
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          v.name.toLowerCase().includes(term) ||
          v.barcode.includes(term) ||
          v.modelNo.toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [q, app.variants, app.products]);

  const totals = computeTotals(lines, app.company);
  const paid = cash + qr;
  const change = Math.max(0, paid - totals.total);

  const addVariant = (variantId: string) => {
    const v = app.variants.find((x) => x.id === variantId);
    if (!v) return;
    const p = app.products.find((x) => x.id === v.productId);
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variantId);
      if (existing) {
        return prev.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          id: `cl-${variantId}-${prev.length}`,
          productId: v.productId,
          variantId,
          description: `${p?.name ?? "Item"} — ${v.name}`,
          qty: 1,
          unitId: v.unitId,
          rate: v.sellingPrice,
          discount: 0,
          maxStock: v.stock[branchId] ?? 0,
        },
      ];
    });
    setQ("");
  };

  const patch = (id: string, p: Partial<CartLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));

  const checkout = (print: boolean) => {
    if (lines.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!customerId) {
      toast.error("Choose a customer");
      return;
    }
    const inv = app.createInvoice({
      kind: app.company.vatRegistered ? "tax" : "abbreviated",
      date: date ?? new Date().toISOString(),
      branchId,
      customerId,
      lines: lines.map(({ maxStock: _m, ...l }) => l),
      paymentMethod: qr > 0 && cash > 0 ? "cash" : qr > 0 ? "qr" : "cash",
      paidAmount: Math.min(paid, totals.total),
      status:
        paid >= totals.total ? "paid" : paid > 0 ? "partial" : "unpaid",
    });
    setLines([]);
    setCash(0);
    setQr(0);
    toast.success(`Sale complete — ${inv.number}`);
    if (print) void navigate({ to: "/print/$invoiceId", params: { invoiceId: inv.id } });
  };

  return (
    <div>
      <PageHeader
        title="Point of Sale"
        subtitle="Scan a barcode or search, then take payment by cash or QR."
      />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border bg-card">
          <div className="relative border-b p-3">
            <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) addVariant(results[0].id);
              }}
              placeholder="Scan barcode or search by name, SKU, model…"
              className="pl-9"
            />
            {results.length > 0 && (
              <div className="absolute left-3 right-3 top-[54px] z-20 overflow-hidden rounded-lg border bg-popover shadow-md">
                {results.map((v) => {
                  const p = app.products.find((x) => x.id === v.productId);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => addVariant(v.id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/60"
                    >
                      <MediaThumb mediaId={p?.mediaId} className="h-9 w-9" alt={p?.name ?? "Product"} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{p?.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {v.name} · {v.barcode || v.modelNo}
                        </span>
                      </span>
                      <Money value={v.sellingPrice} className="text-sm" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <EmptyState
              title="Cart is empty"
              description="Search a product above or scan its barcode to start a sale."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-center font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Disc</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="truncate">{l.description}</p>
                      <p className="text-xs text-muted-foreground">
                        In stock: {l.maxStock} {app.unitSymbol(l.unitId)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => patch(l.id, { qty: Math.max(1, l.qty - 1) })}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          value={l.qty}
                          onChange={(e) => patch(l.id, { qty: Number(e.target.value) || 1 })}
                          className="num h-7 w-14 text-center"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => patch(l.id, { qty: l.qty + 1 })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        value={l.rate}
                        onChange={(e) => patch(l.id, { rate: Number(e.target.value) || 0 })}
                        className="num h-7 w-24 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        value={l.discount}
                        onChange={(e) => patch(l.id, { discount: Number(e.target.value) || 0 })}
                        className="num h-7 w-20 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={(l.rate - l.discount) * l.qty} />
                    </td>
                    <td className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label className="text-xs">Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Walk-in / choose customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.pan ? ` · PAN ${c.pan}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" onClick={() => setCustOpen(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <DatePicker value={date} onChange={setDate} className="mt-1 w-full" />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Sub total</dt>
                <dd>
                  <Money value={totals.gross} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd>
                  <Money value={-totals.discount} />
                </dd>
              </div>
              {app.company.vatRegistered && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Taxable amount</dt>
                    <dd>
                      <Money value={totals.taxable} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">VAT {app.company.vatRate}%</dt>
                    <dd>
                      <Money value={totals.vat} />
                    </dd>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-medium">
                <dt>Total</dt>
                <dd>
                  <Money value={totals.total} />
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <Label className="text-xs">Payment method</Label>
              <div className="mt-1 grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                {(["cash", "qr", "split"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMethod(m);
                      if (m === "cash") {
                        setCash(totals.total);
                        setQr(0);
                      } else if (m === "qr") {
                        setQr(totals.total);
                        setCash(0);
                      }
                    }}
                    className={cn(
                      "rounded px-2 py-1.5 text-sm capitalize transition-colors",
                      method === m
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "qr" ? "QR" : m}
                  </button>
                ))}
              </div>
            </div>

            {method === "qr" || method === "split" ? (
              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="mr-1.5 h-4 w-4" /> Show QR to customer
              </Button>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <Label className="flex items-center gap-1 text-xs">
                  <Wallet className="h-3.5 w-3.5" /> Cash received
                </Label>
                <Input
                  value={cash}
                  onChange={(e) => setCash(Number(e.target.value) || 0)}
                  className="num mt-1 text-right"
                  disabled={method === "qr"}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1 text-xs">
                  <QrCode className="h-3.5 w-3.5" /> QR received
                </Label>
                <Input
                  value={qr}
                  onChange={(e) => setQr(Number(e.target.value) || 0)}
                  className="num mt-1 text-right"
                  disabled={method === "cash"}
                />
              </div>
            </div>
            <p className="num mt-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Change due</span>
              <Money value={change} />
            </p>


            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => checkout(false)}>
                Save sale
              </Button>
              <Button onClick={() => checkout(true)}>Pay &amp; print</Button>
            </div>
          </div>

          {app.company.qrImageUrl && (
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Scan to pay
              </p>
              <img
                src={app.company.qrImageUrl}
                alt="Static payment QR code for the shop"
                className="mx-auto h-36 w-36 rounded border object-contain"
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan to pay</DialogTitle>
            <DialogDescription>
              Show this QR to the customer. Confirm once the payment notification arrives.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-center">
            {app.company.qrImageUrl ? (
              <img
                src={app.company.qrImageUrl}
                alt="Static payment QR code for the shop"
                className="mx-auto h-56 w-56 rounded border object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No QR uploaded yet{app.can("settings.manage") ? "" : " — ask the owner to add one in Settings"}.
              </p>
            )}
            {app.can("settings.manage") ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-left">
                <p className="mb-2 text-xs text-muted-foreground">
                  {app.company.qrImageUrl ? "Replace" : "Upload"} the shop payment QR without
                  leaving the counter.
                </p>
                <MediaPicker
                  label={app.company.qrImageUrl ? "Replace QR" : "Upload QR"}
                  value={undefined}
                  onChange={(id) => {
                    const m = app.media.find((x) => x.id === id);
                    app.updateCompany({ qrImageUrl: m?.url });
                    toast.success("Payment QR updated");
                  }}
                />
              </div>
            ) : null}
            <p className="num text-lg font-semibold">
              <Money value={totals.total} />
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setQr(method === "qr" ? totals.total : Math.max(0, totals.total - cash));
                setQrOpen(false);
                toast.success("QR payment marked as received");
              }}
            >
              Payment received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerDialog
        open={custOpen}
        onOpenChange={setCustOpen}
        kind="customer"
        onCreated={(p) => setCustomerId(p.id)}
      />
    </div>
  );
}
