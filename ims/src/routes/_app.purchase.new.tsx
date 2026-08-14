import { DatePicker } from "@/components/common/date-picker";
import { Money, PageHeader } from "@/components/common/primitives";
import {
  PurchaseItemCard,
  emptyRow,
  newRowKey,
  type DraftItem,
} from "@/components/purchase/purchase-item-card";
import { CustomerDialog } from "@/components/parties/party-dialogs";
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
import { useMemo, useState } from "react";
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

  const suppliers = app.parties.filter((p) => p.kind === "supplier");
  const itemsTotal = useMemo(
    () => items.reduce((s, i) => s + i.rows.reduce((x, r) => x + r.qty * r.unitCost, 0), 0),
    [items],
  );
  const effectiveBill = billAmount === "" ? itemsTotal : Number(billAmount);
  const difference = effectiveBill - itemsTotal;
  const tracking = partyId !== "none" && postToLedger;

  const patchItem = (key: string, next: DraftItem) =>
    setItems((prev) => prev.map((i) => (i.key === key ? next : i)));

  const reset = () => {
    setItems([makeItem()]);
    setBillNo("");
    setNote("");
    setBillAmount("");
    setPaidAmount(0);
  };

  const save = () => {
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
          rows: rows.map((r) => ({
            name: r.name.trim() || "Default",
            modelNo: r.modelNo,
            barcode: r.barcode,
            unitId: r.unitId,
            qty: r.qty,
            unitCost: r.unitCost,
            sellingPrice: r.sellingPrice,
            lowStockAt: r.lowStockAt,
          })),
        });
      }
    }
    const totalRows = payload.reduce((s, p) => s + p.rows.length, 0);
    if (totalRows === 0) {
      toast.error("Add at least one item with a quantity");
      return;
    }
    const purchase = app.createPurchase({
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
    toast.success(`Purchase recorded — ${purchase.number}`, {
      description: tracking
        ? "Stock received and party ledger updated."
        : "Stock received. No ledger entry posted.",
    });
    reset();
  };

  return (
    <div>
      <PageHeader
        title="New Purchase Entry"
        subtitle="Enter a whole supplier bill at once — many products, each with its own variants."
        actions={
          <Button onClick={save} disabled={!app.can("purchase.create")}>
            Save purchase
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
                <Select value={partyId} onValueChange={setPartyId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No party (stock only)</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <div className="flex justify-end rounded-lg border bg-card px-4 py-3 text-sm">
            <span className="mr-3 text-muted-foreground">Items total</span>
            <span className="font-medium">
              <Money value={itemsTotal} />
            </span>
          </div>
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
