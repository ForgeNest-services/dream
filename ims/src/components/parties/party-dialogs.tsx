import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/common/date-picker";
import { DateText, Money } from "@/components/common/primitives";
import { useApp } from "@/context/app-store";
import type { Party } from "@/data/types";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function CustomerDialog({
  open,
  onOpenChange,
  kind,
  party,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: "customer" | "supplier";
  party?: Party | undefined;
  onCreated?: ((p: Party) => void) | undefined;
}) {
  const app = useApp();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    pan: "",
    isVatRegistered: false,
    creditLimit: 0,
    openingBalance: 0,
    terms: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: party?.name ?? "",
      phone: party?.phone ?? "",
      email: party?.email ?? "",
      address: party?.address ?? "",
      pan: party?.pan ?? "",
      isVatRegistered: party?.isVatRegistered ?? false,
      creditLimit: party?.creditLimit ?? 0,
      openingBalance: party?.openingBalance ?? 0,
      terms: party?.terms ?? "",
    });
  }, [open, party]);

  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(party);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone,
        email: form.email || undefined,
        address: form.address,
        pan: form.pan || undefined,
        isVatRegistered: form.isVatRegistered,
        creditLimit: kind === "customer" ? form.creditLimit : undefined,
        openingBalance: form.openingBalance,
        terms: form.terms || undefined,
      };
      const res = isEdit
        ? await app.updateParty(party!.id, payload)
        : await app.addParty({ ...payload, kind });
      if (!res.ok || !res.party) {
        toast.error(res.error ?? `Failed to ${isEdit ? "update" : "add"} party`);
        return;
      }
      toast.success(`${kind === "customer" ? "Customer" : "Supplier"} ${isEdit ? "updated" : "added"}`);
      onCreated?.(res.party);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "New"} {kind}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Name</Label>
            <Input
              name="party-name"
              autoComplete="off"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input
              name="party-phone"
              // Chrome ignores a literal autocomplete="off" on fields it
              // heuristically detects as contact info (a deliberate Chrome
              // policy, not a bug) — a nonsense token it doesn't recognize
              // as a real autofill category is the actual way to opt out.
              autoComplete="new-party-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              name="party-email"
              autoComplete="new-party-email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Address</Label>
            <Input
              name="party-address"
              autoComplete="off"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">PAN / VAT no.</Label>
            <Input
              name="party-pan"
              autoComplete="off"
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value })}
              className="num mt-1"
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch
              checked={form.isVatRegistered}
              onCheckedChange={(v) => setForm({ ...form, isVatRegistered: v })}
            />
            <span className="text-sm">VAT registered</span>
          </div>
          {kind === "customer" ? (
            <div>
              <Label className="text-xs">Credit limit</Label>
              <Input
                name="party-credit-limit"
                autoComplete="off"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) || 0 })}
                className="num mt-1"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs">Payment terms</Label>
              <Input
                name="party-terms"
                autoComplete="off"
                value={form.terms}
                onChange={(e) => setForm({ ...form, terms: e.target.value })}
                className="mt-1"
                placeholder="Net 30"
              />
            </div>
          )}
          <div>
            <Label className="text-xs">
              Opening balance ({kind === "supplier" ? "payable to them" : "receivable"})
            </Label>
            <Input
              name="party-opening-balance"
              autoComplete="off"
              value={form.openingBalance}
              onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) || 0 })}
              className="num mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentDialog({
  open,
  onOpenChange,
  party,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  party?: Party | undefined;
}) {
  const app = useApp();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState<string | null>(new Date().toISOString());

  useEffect(() => {
    if (open && party) setAmount(Math.abs(app.partyBalance(party.id)));
  }, [open, party, app]);

  if (!party) return null;

  const save = async () => {
    if (amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    const res = await app.recordPayment({
      partyId: party.id,
      amount,
      date: date ?? new Date().toISOString(),
      method,
      reference: reference || undefined,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Failed to record payment");
      return;
    }
    toast.success("Payment recorded");
    onOpenChange(false);
    setReference("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Record payment {party.kind === "supplier" ? "to" : "from"} {party.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs">Amount</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="num mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="qr">QR</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <DatePicker value={date} onChange={setDate} className="mt-1 w-full" />
          </div>
          <div>
            <Label className="text-xs">Reference</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1"
              placeholder="Voucher / cheque no."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LedgerDialog({
  open,
  onOpenChange,
  party,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  party?: Party | undefined;
}) {
  const app = useApp();
  const rows = useMemo(() => {
    if (!party) return [];
    const entries = app.ledger
      .filter((l) => l.partyId === party.id)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const isSupplier = party.kind === "supplier";
    let bal = 0;
    return entries.map((e) => {
      bal += isSupplier ? e.credit - e.debit : e.debit - e.credit;
      return { ...e, balance: bal };
    });
  }, [app.ledger, party]);

  if (!party) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{party.name} — party ledger</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-card text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Debit</th>
                <th className="px-3 py-2 text-right font-medium">Credit</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <DateText value={r.date} />
                  </td>
                  <td className="px-3 py-2">
                    {r.description}
                    {r.reference ? (
                      <span className="ml-1 text-xs text-muted-foreground">({r.reference})</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.debit ? <Money value={r.debit} /> : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.credit ? <Money value={r.credit} /> : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={r.balance} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No ledger entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
