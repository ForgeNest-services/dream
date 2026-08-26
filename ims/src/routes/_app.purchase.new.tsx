import { DatePicker } from "@/components/common/date-picker";
import { Money, PageHeader } from "@/components/common/primitives";
import {
  PurchaseItemCard,
  emptyRow,
  newRowKey,
  type DraftItem,
} from "@/components/purchase/purchase-item-card";
import { CustomerDialog } from "@/components/parties/party-dialogs";
import { PartyCombobox } from "@/components/parties/party-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApp, type PurchaseDraftItem } from "@/context/app-store";
import type { PaymentMethod } from "@/data/types";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchase/new")({
  head: () => ({
    meta: [
      { title: "New Purchase Entry — SROTA IMS" },
      {
        name: "description",
        content:
          "Record a supplier bill: enter many products and variants at once, receive stock into a branch and post the bill and payment to the party ledger.",
      },
      { property: "og:title", content: "New Purchase Entry — SROTA IMS" },
      {
        property: "og:description",
        content: "Bulk product entry against a supplier bill with optional party ledger posting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewPurchasePage,
});

let itemSeq = 0;

function makeItem(): DraftItem {
  return {
    key: `i${++itemSeq}`,
    kind: "existing",
    name: "",
    sku: "",
    categoryId: "",
    brandId: "none",
    taxable: true,
    rows: [],
  };
}

function NewPurchasePage() {
  const app = useApp();
  const unitId = app.units[0]?.id ?? "";
  const defaultBranch = app.branchId === "all" ? (app.branches[0]?.id ?? "") : app.branchId;

  const [partyId, setPartyId] = useState("none");
  const [branchId, setBranchId] = useState(defaultBranch);
  const [date, setDate] = useState<string | null>(new Date().toISOString());
  const [billNo, setBillNo] = useState("");
  const [note, setNote] = useState("");
  const [postToLedger, setPostToLedger] = useState(true);
  const [billAmount, setBillAmount] = useState<number | "">("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([makeItem()]);

  // Branches load asynchronously after mount (see app-store's bootstrap
  // effect) — the useState(defaultBranch) initializer above only runs once,
  // so if it fires before branches arrive, branchId is stuck on "" forever
  // and the backend correctly 404s with BRANCH_NOT_FOUND. Sync once branches
  // land, but only while the field is still unset/stale so it doesn't
  // clobber a branch the user already picked.
  useEffect(() => {
    if (branchId) return;
    const fallback = app.branchId === "all" ? (app.branches[0]?.id ?? "") : app.branchId;
    if (fallback) setBranchId(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.branches, app.branchId]);

  const suppliers = app.parties.filter((p) => p.kind === "supplier");
  const itemsTotal = useMemo(
    () => items.reduce((s, i) => s + i.rows.reduce((x, r) => x + r.qty * r.unitCost, 0), 0),
    [items],
  );
  const effectiveBill = billAmount === "" ? itemsTotal : Number(billAmount);
  const difference = effectiveBill - itemsTotal;
  const tracking = partyId !== "none" && postToLedger;

  const taxTotals = useMemo(() => {
    let taxableAmt = 0;
    let nonTaxableAmt = 0;
    let vat = 0;
    // Non-VAT tenants (PAN-only, or VAT-eligible but currently toggled off
    // in Settings) never compute VAT here — mirrors the same gate
    // PurchaseItemCard already applies per-row, so the summary box below
    // can't disagree with what each row actually shows.
    for (const item of items) {
      const product = item.kind === "existing" ? app.products.find((p) => p.id === item.productId) : undefined;
      const taxable =
        app.company.vatRegistered &&
        (item.kind === "existing" ? product?.taxable !== false : item.taxable);
      const rate = taxable
        ? (item.kind === "existing" ? (product?.taxRate ?? app.company.vatRate) : (item.taxRate ?? app.company.vatRate))
        : 0;
      for (const r of item.rows) {
        const lineAmt = r.qty * r.unitCost;
        if (taxable) {
          taxableAmt += lineAmt;
          vat += (lineAmt * rate) / 100;
        } else {
          nonTaxableAmt += lineAmt;
        }
      }
    }
    return { taxableAmt, nonTaxableAmt, vat, net: taxableAmt + nonTaxableAmt + vat };
  }, [items, app.products, app.company.vatRate, app.company.vatRegistered]);

  const patchItem = (key: string, next: DraftItem) =>
    setItems((prev) => prev.map((i) => (i.key === key ? next : i)));

  const reset = () => {
    setItems([makeItem()]);
    setBillNo("");
    setNote("");
    setBillAmount("");
    setPaidAmount(0);
  };

  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: PurchaseDraftItem[] = [];
    for (const i of items) {
      const rows = i.rows.filter((r) => r.qty > 0 || i.kind === "new");
      if (rows.length === 0) continue;
      if (i.kind === "existing") {
        if (!i.productId) continue;
        payload.push({
          kind: "existing",
          productId: i.productId,
          rows: rows
            .filter((r) => r.variantId && r.qty > 0)
            .map((r) => ({
              variantId: r.variantId!,
              qty: r.qty,
              unitCost: r.unitCost,
              sellingPrice: r.sellingPrice,
              expiryDate: r.expiryDate || undefined,
            })),
        });
      } else {
        if (!i.name.trim()) {
          toast.error("Every new product needs a name");
          return;
        }
        if (!i.categoryId) {
          toast.error(`Choose a category for "${i.name}"`);
          return;
        }
        payload.push({
          kind: "new",
          name: i.name.trim(),
          sku: i.sku.trim() || i.name.trim().slice(0, 3).toUpperCase() + "-" + Date.now().toString(36).slice(-4).toUpperCase(),
          categoryId: i.categoryId,
          brandId: i.brandId === "none" ? undefined : i.brandId,
          mediaId: i.mediaId,
          taxable: i.taxable,
          taxRate: i.taxRate,
          rows: rows.map((r) => ({
            name: r.name.trim() || "Default",
            modelNo: r.modelNo,
            barcode: r.barcode,
            unitId: r.unitId,
            qty: r.qty,
            unitCost: r.unitCost,
            sellingPrice: r.sellingPrice,
            lowStockAt: r.lowStockAt,
            expiryDate: r.expiryDate || undefined,
          })),
        });
      }
    }
    const totalRows = payload.reduce((s, p) => s + p.rows.length, 0);
    if (totalRows === 0) {
      toast.error("Add at least one item with a quantity");
      return;
    }
    if (!branchId) {
      toast.error("Choose a branch to receive stock into");
      return;
    }
    setSaving(true);
    try {
      const res = await app.createPurchase({
        date: date ?? new Date().toISOString(),
        branchId,
        partyId: partyId === "none" ? undefined : partyId,
        billNo: billNo.trim() || undefined,
        note: note.trim() || undefined,
        billAmount: tracking ? effectiveBill : 0,
        paidAmount: tracking ? paidAmount : 0,
        paymentMethod: method,
        postToLedger: tracking,
        items: payload,
      });
      if (!res.ok || !res.purchase) {
        toast.error(res.error ?? "Failed to record purchase");
        return;
      }
      toast.success(`Purchase recorded — ${res.purchase.number}`, {
        description: tracking
          ? "Stock received and party ledger updated."
          : "Stock received. No ledger entry posted.",
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="New Purchase Entry"
        subtitle="Enter a whole supplier bill at once — many products, each with its own variants."
        actions={
          <Button onClick={save} disabled={!app.can("purchase.create") || saving}>
            {saving ? "Saving…" : "Save purchase"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Party & bill
            </p>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label className="text-xs">Supplier (optional)</Label>
                <PartyCombobox
                  kind="supplier"
                  value={partyId}
                  selected={suppliers.find((s) => s.id === partyId)}
                  onChange={setPartyId}
                  noneLabel="No party (stock only)"
                  noneValue="none"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => setSupplierOpen(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Entry date</Label>
              <DatePicker value={date} onChange={setDate} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Bill no.</Label>
                <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="e.g. 2083-114" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {app.branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Track party ledger</p>
                <p className="text-xs text-muted-foreground">
                  Post the bill to the supplier's account
                </p>
              </div>
              <Switch
                checked={postToLedger}
                onCheckedChange={setPostToLedger}
                disabled={partyId === "none"}
              />
            </div>

            <dl className="space-y-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items total</dt>
                <dd>
                  <Money value={itemsTotal} />
                </dd>
              </div>
            </dl>

            {tracking ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Bill amount (as per supplier bill)</Label>
                  <Input
                    type="number"
                    value={billAmount}
                    placeholder={String(itemsTotal)}
                    onChange={(e) =>
                      setBillAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="num text-right"
                  />
                  <p className="text-xs text-muted-foreground">
                    Goes to the credit side of the ledger. Leave blank to use the items total.
                  </p>
                </div>
                {difference !== 0 && (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                    Difference vs items:{" "}
                    <span className="font-medium text-foreground">
                      <Money value={difference} />
                    </span>{" "}
                    (discount, freight or rounding)
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Paid now</Label>
                    <Input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                      className="num text-right"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Method</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="qr">QR</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="credit">Credit (unpaid)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPaidAmount(effectiveBill)}>
                    Pay full
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPaidAmount(0)}>
                    All credit
                  </Button>
                </div>
                <p className="flex justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">Balance to party</span>
                  <span className="font-medium">
                    <Money value={Math.max(0, effectiveBill - paidAmount)} />
                  </span>
                </p>
              </>
            ) : (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                No ledger entry will be created for this purchase. Stock is still received.
              </p>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>
        </aside>

        <section className="space-y-3">
          {items.map((item, idx) => (
            <PurchaseItemCard
              key={item.key}
              index={idx}
              item={item}
              onChange={(next) => patchItem(item.key, next)}
              onRemove={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setItems((p) => [...p, makeItem()])}>
              <Plus className="mr-1.5 h-4 w-4" /> Add item from catalogue
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setItems((p) => [
                  ...p,
                  { ...makeItem(), kind: "new", rows: [{ ...emptyRow(unitId), key: newRowKey() }] },
                ])
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add new product
            </Button>
          </div>
          {app.company.vatRegistered ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border bg-card px-4 py-3 text-sm sm:grid-cols-4">
              <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
                <dt className="text-muted-foreground">Taxable</dt>
                <dd className="num font-medium">
                  <Money value={taxTotals.taxableAmt} />
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
                <dt className="text-muted-foreground">Non-taxable</dt>
                <dd className="num font-medium">
                  <Money value={taxTotals.nonTaxableAmt} />
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
                <dt className="text-muted-foreground">VAT</dt>
                <dd className="num font-medium">
                  <Money value={taxTotals.vat} />
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-t pt-1.5 sm:flex-col sm:gap-0.5 sm:border-t-0 sm:pt-0">
                <dt className="text-muted-foreground">Net</dt>
                <dd className="num font-semibold">
                  <Money value={taxTotals.net} />
                </dd>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="num font-semibold">
                <Money value={taxTotals.net} />
              </dd>
            </div>
          )}
        </section>
      </div>

      <CustomerDialog
        open={supplierOpen}
        onOpenChange={setSupplierOpen}
        kind="supplier"
        onCreated={(p) => setPartyId(p.id)}
      />
    </div>
  );
}
