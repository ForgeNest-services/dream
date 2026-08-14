import { useMemo, useState } from "react";
import { History, Phone, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NPR, type Customer } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { KhataSettleDialog } from "./KhataSettleDialog";
import { KhataHistoryDialog } from "./KhataHistoryDialog";

// Dedicated Khata page — a focused view of just customers with outstanding
// tabs. Separated from Customers (which is a general directory) because
// khata is a whole workflow of its own: accepting payments, tracking dues,
// running the tab log.
export function KhataView() {
  const { customers, customersLoading } = usePos();
  const [search, setSearch] = useState("");
  const [settleTarget, setSettleTarget] = useState<Customer | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null);

  const withBalance = useMemo(
    () => customers.filter((c) => c.outstandingBalance > 0),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? withBalance.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
        )
      : withBalance;
    // Biggest debtors first — that's who the owner cares about.
    return [...list].sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  }, [withBalance, search]);

  const totalOutstanding = withBalance.reduce((s, c) => s + c.outstandingBalance, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">Khata</h2>
        <p className="text-xs text-muted-foreground">
          Customers on running tabs. Settle their balance in full or partial.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="pos-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total outstanding
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-primary">
            {NPR(totalOutstanding)}
          </p>
        </div>
        <div className="pos-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Open tabs
          </p>
          <p className="mt-1 font-display text-2xl font-semibold">{withBalance.length}</p>
        </div>
        <div className="pos-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            All customers
          </p>
          <p className="mt-1 font-display text-2xl font-semibold">{customers.length}</p>
        </div>
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

      {!customersLoading && withBalance.length === 0 && (
        <p className="pos-card p-8 text-center text-sm text-muted-foreground">
          No open khatas — everyone's paid up.
        </p>
      )}

      {!customersLoading && withBalance.length > 0 && filtered.length === 0 && (
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
              <span className="shrink-0 rounded-md bg-warning px-2 py-1 text-[11px] font-semibold text-navy">
                Due {NPR(c.outstandingBalance)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-11 flex-1 bg-success text-success-foreground hover:bg-success/90"
                onClick={() => setSettleTarget(c)}
              >
                <Wallet className="size-4" />
                Settle
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11"
                onClick={() => setHistoryTarget(c)}
              >
                <History className="size-4" />
                Log
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {settleTarget && (
        <KhataSettleDialog
          customer={settleTarget}
          onClose={() => setSettleTarget(null)}
        />
      )}

      {historyTarget && (
        <KhataHistoryDialog
          customer={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
