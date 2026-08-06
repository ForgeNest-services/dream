import { useState } from "react";
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
  EXPENSE_CATEGORIES,
  NPR,
  type Expense,
  type ExpenseCategory,
} from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

const blank = (): Expense => ({
  id: "",
  date: new Date().toISOString().slice(0, 10),
  category: "Supplies",
  amount: 0,
  note: "",
});

export function ExpensesView() {
  const { expenses, saveExpense, deleteExpense } = usePos();
  const [draft, setDraft] = useState<Expense | null>(null);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    category: c,
    amount: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.amount > 0);

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
        {byCategory.map((c) => (
          <div key={c.category} className="pos-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.category}</p>
            <p className="mt-1 font-display text-xl">{NPR(c.amount)}</p>
          </div>
        ))}
      </div>

      <ul className="space-y-2">
        {expenses.map((e) => (
          <li key={e.id} className="pos-card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{e.category}</span>
                <span className="text-xs text-muted-foreground">{e.date}</span>
              </div>
              <p className="mt-1 truncate text-sm">{e.note || "—"}</p>
            </div>
            <span className="shrink-0 font-display text-base font-semibold">{NPR(e.amount)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              aria-label={`Edit ${e.note}`}
              onClick={() => setDraft(e)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-danger"
              aria-label={`Delete ${e.note}`}
              onClick={() => deleteExpense(e.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {expenses.length === 0 && (
          <li className="pos-card p-8 text-center text-sm text-muted-foreground">
            No expenses recorded yet.
          </li>
        )}
      </ul>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {draft?.id ? "Edit expense" : "Add expense"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  className="h-12"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft({ ...draft, category: v as ExpenseCategory })}
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
                <Label>Amount</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="h-12"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input
                  className="h-12"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              className="h-12 w-full"
              onClick={() => {
                if (!draft) return;
                saveExpense({ ...draft, id: draft.id || Math.random().toString(36).slice(2, 10) });
                setDraft(null);
              }}
            >
              Save expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
