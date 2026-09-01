import { DatePicker } from "@/components/common/date-picker";
import { Qty } from "@/components/common/primitives";
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
import { DecimalTextInput, NumericInput } from "@/components/inventory/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/context/app-store";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const REASONS = [
  "Damage / breakage",
  "Physical count correction",
  "Expiry / write-off",
  "Branch transfer out",
  "Opening balance",
  "Other",
];

function useDefaults() {
  const app = useApp();
  const branch = app.branchId === "all" ? (app.branches[0]?.id ?? "") : app.branchId;
  return { branch };
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  productId,
  variantId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId?: string | undefined;
  variantId?: string | undefined;
}) {
  const app = useApp();
  const { branch } = useDefaults();
  const [pid, setPid] = useState(productId ?? "");
  const [vid, setVid] = useState(variantId ?? "");
  const [branchId, setBranchId] = useState(branch);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState(REASONS[0]!);
  const [date, setDate] = useState<string | null>(new Date().toISOString());

  useEffect(() => {
    if (!open) return;
    setPid(productId ?? app.products[0]?.id ?? "");
    setVid(variantId ?? "");
    setBranchId(branch);
    setQty(1);
    setDirection("in");
    setDate(new Date().toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, variantId]);

  const variants = useMemo(() => (pid ? app.variantsOf(pid) : []), [pid, app]);
  useEffect(() => {
    if (variants.length && !variants.some((v) => v.id === vid)) setVid(variants[0]!.id);
  }, [variants, vid]);

  const variant = app.variants.find((v) => v.id === vid);
  const current = variant?.stock[branchId] ?? 0;

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!variant || qty <= 0) {
      toast.error("Pick a variant and a quantity above zero");
      return;
    }
    const signed = direction === "in" ? qty : -qty;
    if (current + signed < 0) {
      toast.error("Adjustment would make stock negative");
      return;
    }
    setSubmitting(true);
    try {
      const res = await app.adjustStock({
        variantId: variant.id,
        branchId,
        qty: signed,
        reason,
        date: date ?? new Date().toISOString(),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to adjust stock");
        return;
      }
      toast.success(`Stock adjusted — new balance ${current + signed}`);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Corrections, damages and write-offs. Every adjustment is logged.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {app.products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Variant</Label>
              <Select value={vid} onValueChange={setVid}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Increase (+)</SelectItem>
                  <SelectItem value="out">Decrease (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <NumericInput value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker value={date} onChange={setDate} className="w-full" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Current balance: <Qty value={current} unit={app.unitSymbol(variant?.unitId ?? "")} /> →{" "}
            <span className="font-medium text-foreground">
              <Qty value={current + (direction === "in" ? qty : -qty)} />
            </span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Posting…" : "Post adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RestockDialog({
  open,
  onOpenChange,
  productId,
  variantId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId?: string | undefined;
  variantId?: string | undefined;
}) {
  const app = useApp();
  const { branch } = useDefaults();
  const [pid, setPid] = useState(productId ?? "");
  const [vid, setVid] = useState(variantId ?? "");
  const [branchId, setBranchId] = useState(branch);
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [supplierId, setSupplierId] = useState("none");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState<string | null>(new Date().toISOString());
  const [postToLedger, setPostToLedger] = useState(false);
  const [billAmount, setBillAmount] = useState<number | "">("");

  useEffect(() => {
    if (!open) return;
    setPid(productId ?? app.products[0]?.id ?? "");
    setVid(variantId ?? "");
    setBranchId(branch);
    setQty(1);
    setSupplierId("none");
    setReference("");
    setPostToLedger(false);
    setBillAmount("");
    setDate(new Date().toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, variantId]);

  const variants = useMemo(() => (pid ? app.variantsOf(pid) : []), [pid, app]);
  useEffect(() => {
    if (variants.length && !variants.some((v) => v.id === vid)) {
      setVid(variants[0]!.id);
      setCost(variants[0]!.costPrice);
    }
  }, [variants, vid]);

  const variant = app.variants.find((v) => v.id === vid);
  const suppliers = app.parties.filter((p) => p.kind === "supplier");
  const lineTotal = (Number(qty) || 0) * (Number(cost) || 0);

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!variant || qty <= 0) {
      toast.error("Pick a variant and a quantity above zero");
      return;
    }
    const tracking = supplierId !== "none" && postToLedger;
    setSubmitting(true);
    try {
      const res = await app.restock({
        variantId: variant.id,
        branchId,
        qty,
        unitCost: Number(cost) || 0,
        supplierId: supplierId === "none" ? undefined : supplierId,
        reference: reference.trim() || undefined,
        date: date ?? new Date().toISOString(),
        postToLedger: tracking,
        billAmount: billAmount === "" ? lineTotal : Number(billAmount),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to receive stock");
        return;
      }
      toast.success(
        tracking ? "Stock received — party ledger updated" : "Stock received",
      );
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restock</DialogTitle>
          <DialogDescription>
            Receive goods into a branch. Ledger posting is optional — for a full supplier bill with
            many products use Purchase → New Purchase.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {app.products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Variant</Label>
              <Select
                value={vid}
                onValueChange={(v) => {
                  setVid(v);
                  const found = app.variants.find((x) => x.id === v);
                  if (found) setCost(found.costPrice);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Quantity ({app.unitSymbol(variant?.unitId ?? "")})</Label>
              <NumericInput value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit cost</Label>
              <DecimalTextInput value={cost} onChange={setCost} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker value={date} onChange={setDate} className="w-full" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Supplier (optional)</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bill / reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. PB-2082-114"
              />
            </div>
          </div>
          {supplierId !== "none" && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Post to party ledger</p>
                  <p className="text-xs text-muted-foreground">
                    Off by default — nothing is posted unless you confirm the bill amount.
                  </p>
                </div>
                <Switch checked={postToLedger} onCheckedChange={setPostToLedger} />
              </div>
              {postToLedger && (
                <div className="space-y-1.5">
                  <Label>Bill amount</Label>
                  <Input
                    type="number"
                    value={billAmount}
                    placeholder={String(lineTotal)}
                    onChange={(e) =>
                      setBillAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="num text-right"
                  />
                  <p className="text-xs text-muted-foreground">
                    Defaults to qty × cost ({lineTotal}). Edit it to match the supplier bill.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Receiving…" : "Receive stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
