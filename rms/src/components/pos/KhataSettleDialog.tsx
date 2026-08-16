import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NPR, type Customer } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

// Settle any amount ≤ outstanding balance. Cash or QR. Optional note.
// Server clamps: amount must be > 0 and ≤ current balance.
export function KhataSettleDialog({
  customer,
  onClose,
  onSettled,
}: {
  customer: Customer;
  onClose: () => void;
  onSettled?: (newBalance: number) => void;
}) {
  const { addKhataSettlement, settings } = usePos();
  const [method, setMethod] = useState<"cash" | "qr">("cash");
  const [amount, setAmount] = useState<string>(String(customer.outstandingBalance));
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numericAmount = Number(amount);
  const isValidAmount =
    Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount <= customer.outstandingBalance;
  const isPartial = isValidAmount && numericAmount < customer.outstandingBalance;

  return (
    <Dialog open onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Settle {customer.name}'s khata
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border-2 border-warning bg-warning/10 p-4 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-navy/70">
              Outstanding balance
            </p>
            <p className="mt-1 font-display text-3xl font-semibold text-navy">
              {NPR(customer.outstandingBalance)}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label>Amount received (NPR)</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setAmount(String(customer.outstandingBalance))}
              >
                Pay full
              </button>
            </div>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={customer.outstandingBalance}
              className="h-14 text-lg font-semibold"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {isPartial && (
              <p className="text-[11px] text-muted-foreground">
                Remaining after this payment:{" "}
                <span className="font-semibold">
                  {NPR(customer.outstandingBalance - numericAmount)}
                </span>{" "}
                — customer's khata stays open with the remainder.
              </p>
            )}
            {!isValidAmount && amount !== "" && (
              <p className="text-[11px] text-danger">
                Amount must be between Rs 1 and Rs {customer.outstandingBalance}.
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs uppercase">Received via</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["cash", "qr"] as const).map((m) => (
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
          </div>

          {method === "qr" && (
            <div className="grid place-items-center rounded-xl bg-secondary p-4">
              {settings.qrImage ? (
                <img src={settings.qrImage} alt="Payment QR" className="size-44 object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No QR uploaded in Settings yet.
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Show this QR to the customer, then confirm below once you see the payment land.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. paid at counter, ref # 1234…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-12" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="h-12"
            disabled={!isValidAmount || isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                const result = await addKhataSettlement(customer.id, {
                  amount: numericAmount,
                  method,
                  note: note.trim() || undefined,
                });
                if (result) {
                  toast.success(
                    result.newBalance === 0
                      ? `Fully settled — ${NPR(result.amount)} via ${result.method}`
                      : `${NPR(result.amount)} received · ${NPR(result.newBalance)} still on tab`,
                  );
                  onSettled?.(result.newBalance);
                  onClose();
                }
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
