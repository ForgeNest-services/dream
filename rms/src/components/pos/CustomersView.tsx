import { useMemo, useState } from "react";
import { History, Pencil, Phone, Plus, Search, Trash2, UserPlus, Wallet } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NPR, type Customer } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { KhataHistoryDialog } from "./KhataHistoryDialog";
import { KhataSettleDialog } from "./KhataSettleDialog";

const blank = (): Customer => ({
  id: "",
  name: "",
  phone: "",
  address: "",
  notes: "",
  outstandingBalance: 0,
});

export function CustomersView() {
  const { customers, customersLoading, saveCustomer, deleteCustomer, actualRole } = usePos();
  const canEdit = actualRole === "owner" || actualRole === "manager";
  const [draft, setDraft] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [settleTarget, setSettleTarget] = useState<Customer | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">Customers</h2>
          <p className="text-xs text-muted-foreground">
            Recurring diners and khata (running-tab) accounts
          </p>
        </div>
        <Button size="lg" className="h-12 shrink-0" onClick={() => setDraft(blank())}>
          <UserPlus className="size-5" />
          Add customer
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {customersLoading && customers.length === 0 && (
        <p className="pos-card p-8 text-center text-sm text-muted-foreground">
          Loading customers…
        </p>
      )}

      {!customersLoading && customers.length === 0 && (
        <p className="pos-card p-8 text-center text-sm text-muted-foreground">
          No customers yet — add your first with the button above.
        </p>
      )}

      {!customersLoading && customers.length > 0 && filtered.length === 0 && (
        <p className="pos-card p-8 text-center text-sm text-muted-foreground">
          No match for "{search}".
        </p>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <li key={c.id} className="pos-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <Phone className="size-3.5 shrink-0" />
                    {c.phone}
                  </a>
                )}
              </div>
              {c.outstandingBalance > 0 && (
                <span className="shrink-0 rounded-md bg-warning px-2 py-1 text-[11px] font-semibold text-navy">
                  Due {NPR(c.outstandingBalance)}
                </span>
              )}
            </div>
            {c.address && (
              <p className="mt-2 truncate text-xs text-muted-foreground">{c.address}</p>
            )}
            {c.notes && (
              <p className="mt-2 line-clamp-2 rounded-md bg-secondary px-2 py-1 text-xs italic text-muted-foreground">
                {c.notes}
              </p>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {c.outstandingBalance > 0 && canEdit && (
                <Button
                  size="sm"
                  className="h-10 bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => setSettleTarget(c)}
                >
                  <Wallet className="size-4" />
                  Settle
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setHistoryTarget(c)}
              >
                <History className="size-4" />
                Log
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setDraft(c)}
                disabled={!canEdit}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 text-danger"
                aria-label={`Delete ${c.name}`}
                onClick={() => setConfirmDelete(c)}
                disabled={!canEdit}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {draft && (
        <CustomerDialog
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={async (c) => {
            const saved = await saveCustomer(c);
            if (saved) setDraft(null);
          }}
        />
      )}

      {historyTarget && (
        <KhataHistoryDialog
          customer={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {settleTarget && (
        <KhataSettleDialog
          customer={settleTarget}
          onClose={() => setSettleTarget(null)}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The customer disappears from pickers, but their existing khata orders stay in the
              records. If they come back, add them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={async () => {
                if (confirmDelete) await deleteCustomer(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CustomerDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: Customer;
  onClose: () => void;
  onSave: (c: Customer) => Promise<void>;
}) {
  const [c, setC] = useState(draft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const patch = (p: Partial<Customer>) => setC((prev) => ({ ...prev, ...p }));

  return (
    <Dialog open onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {draft.id ? "Edit customer" : "Add customer"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              className="h-12"
              value={c.name}
              onChange={(e) => patch({ name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              className="h-12"
              inputMode="tel"
              type="tel"
              value={c.phone}
              onChange={(e) => patch({ phone: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              Used to find the customer during payment. One phone per branch.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Address (optional)</Label>
            <Input
              className="h-12"
              value={c.address}
              onChange={(e) => patch({ address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={3}
              value={c.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="e.g. prefers window table, office account, dietary notes…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-12" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="h-12"
            disabled={!c.name.trim() || isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                await onSave(c);
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? "Saving…" : draft.id ? "Save" : "Add customer"}
            {!isSubmitting && !draft.id && <Plus className="size-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
