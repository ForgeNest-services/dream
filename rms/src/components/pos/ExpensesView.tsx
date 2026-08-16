import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EXPENSE_CATEGORIES, NPR, type Expense } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { bsIsoToPretty, toBsIso } from "@/lib/pos/nepali-date";
import { BsDatePicker } from "./BsDatePicker";

const blank = (): Expense => ({
  id: "",
  spentAtBs: toBsIso(new Date()) ?? "",
  category: "Supplies",
  amount: 0,
  note: "",
  actorName: "",
});

export function ExpensesView() {
  const { expenses, expensesLoading, saveExpense, deleteExpense } = usePos();
  const [draft, setDraft] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const byCategory = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const e of expenses) buckets[e.category] = (buckets[e.category] ?? 0) + e.amount;
    return Object.entries(buckets)
      .filter(([, amt]) => amt > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount }));
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">Expenses</h2>
          <p className="text-xs text-muted-foreground">Track running costs by category</p>
        </div>
        <Button className="h-11 shrink-0" onClick={() => setDraft(blank())}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="pos-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total expenses</p>
          <p className="mt-1 font-display text-2xl font-semibold text-primary">{NPR(total)}</p>
        </div>
        {byCategory.slice(0, 3).map((c) => (
          <div key={c.category} className="pos-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.category}</p>
            <p className="mt-1 font-display text-xl">{NPR(c.amount)}</p>
          </div>
        ))}
      </div>

      {expensesLoading && expenses.length === 0 && (
        <p className="pos-card p-8 text-center text-sm text-muted-foreground">
          Loading expenses…
        </p>
      )}

      <ul className="space-y-2">
        {expenses.map((e) => (
          <li key={e.id} className="pos-card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{e.category}</span>
                <span className="text-xs text-muted-foreground">
                  {bsIsoToPretty(e.spentAtBs)}
                </span>
                {e.actorName && (
                  <span className="text-[11px] text-muted-foreground">· by {e.actorName}</span>
                )}
              </div>
              <p className="mt-1 truncate text-sm">{e.note || "—"}</p>
            </div>
            <span className="shrink-0 font-display text-base font-semibold">{NPR(e.amount)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              aria-label={`Edit expense`}
              onClick={() => setDraft(e)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-danger"
              aria-label={`Delete expense`}
              onClick={() => setConfirmDelete(e)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {!expensesLoading && expenses.length === 0 && (
          <li className="pos-card p-8 text-center text-sm text-muted-foreground">
            No expenses recorded yet.
          </li>
        )}
      </ul>

      <Dialog open={!!draft} onOpenChange={(o) => !o && !isSaving && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {draft?.id ? "Edit expense" : "Add expense"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date (BS)</Label>
                <BsDatePicker
                  value={draft.spentAtBs}
                  onChange={(v) => setDraft({ ...draft, spentAtBs: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft({ ...draft, category: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (NPR)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="0.01"
                  className="h-12"
                  value={draft.amount || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, amount: Math.max(0, Number(e.target.value)) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Input
                  className="h-12"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="e.g. electricity bill, vegetable restock"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-12"
              onClick={() => setDraft(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="h-12"
              disabled={!draft || draft.amount <= 0 || !draft.spentAtBs || isSaving}
              onClick={async () => {
                if (!draft) return;
                setIsSaving(true);
                try {
                  await saveExpense(draft);
                  setDraft(null);
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? "Saving…" : draft?.id ? "Save" : "Record expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.category} · {NPR(confirmDelete?.amount ?? 0)} ·{" "}
              {confirmDelete ? bsIsoToPretty(confirmDelete.spentAtBs) : ""}. This removes the
              record permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={async () => {
                if (confirmDelete) await deleteExpense(confirmDelete.id);
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
