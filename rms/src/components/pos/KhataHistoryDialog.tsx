import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NPR, type Customer } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { formatDateWithStoredBs } from "@/lib/pos/nepali-date";
import {
  customersApi,
  type KhataHistoryDto,
  type KhataOrderEntryDto,
  type KhataSettlementDto,
} from "@/lib/customers-api";

// Unified timeline item — an order (debit) or a settlement (credit),
// sorted newest-first so the log reads top-down as time goes back.
type TimelineItem =
  | { kind: "order"; at: number; entry: KhataOrderEntryDto }
  | { kind: "settlement"; at: number; entry: KhataSettlementDto };

export function KhataHistoryDialog({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const { branchId } = usePos();
  const [data, setData] = useState<KhataHistoryDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);
    customersApi
      .khataHistory(branchId, customer.id)
      .then((r) => {
        if (cancelled) return;
        setData(r.data ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to load log");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, customer.id]);

  const timeline: TimelineItem[] = useMemo(() => {
    if (!data) return [];
    const items: TimelineItem[] = [
      ...data.orders.map((o) => ({
        kind: "order" as const,
        at: new Date(o.placed_at).getTime(),
        entry: o,
      })),
      ...data.settlements.map((s) => ({
        kind: "settlement" as const,
        at: new Date(s.created_at).getTime(),
        entry: s,
      })),
    ];
    return items.sort((a, b) => b.at - a.at);
  }, [data]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Khata log · {customer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Outstanding"
            value={data ? NPR(Number(data.balance)) : "—"}
            tone={data && Number(data.balance) > 0 ? "warning" : "muted"}
          />
          <StatCard
            label="Debits"
            value={data ? NPR(Number(data.debits_total)) : "—"}
            tone="muted"
            hint="All khata orders"
          />
          <StatCard
            label="Credits"
            value={data ? NPR(Number(data.credits_total)) : "—"}
            tone="success"
            hint="Payments received"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading log…
          </div>
        )}

        {!loading && timeline.length === 0 && (
          <p className="rounded-xl bg-secondary p-6 text-center text-sm text-muted-foreground">
            No khata activity yet — this customer hasn't run a tab.
          </p>
        )}

        {!loading && timeline.length > 0 && (
          <ol className="space-y-2">
            {timeline.map((item) =>
              item.kind === "order" ? (
                <OrderRow key={`o-${item.entry.id}`} entry={item.entry} />
              ) : (
                <SettlementRow key={`s-${item.entry.id}`} entry={item.entry} />
              ),
            )}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "warning" | "success" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning bg-warning/10 text-navy"
      : tone === "success"
        ? "border-success/50 bg-success/10 text-success"
        : "border-border bg-secondary/60 text-foreground";
  return (
    <div className={`rounded-xl border-2 p-3 ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold leading-tight">{value}</p>
      {hint && <p className="text-[10px] opacity-70">{hint}</p>}
    </div>
  );
}

function OrderRow({ entry }: { entry: KhataOrderEntryDto }) {
  const placedTs = new Date(entry.placed_at).getTime();
  return (
    <li className="rounded-xl border border-warning/40 bg-warning/5 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-navy/80">
            <ArrowUp className="size-3.5 text-warning" />
            Debit · {entry.type === "delivery" ? "Delivery" : "Dine-in"} · {entry.line_count} item
            {entry.line_count === 1 ? "" : "s"}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {formatDateWithStoredBs(placedTs, entry.placed_at_bs)}
          </p>
        </div>
        <span className="shrink-0 font-display text-lg font-semibold text-navy">
          +{NPR(Number(entry.total))}
        </span>
      </div>
    </li>
  );
}

function SettlementRow({ entry }: { entry: KhataSettlementDto }) {
  const at = new Date(entry.created_at).getTime();
  return (
    <li className="rounded-xl border border-success/40 bg-success/5 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-success">
            <ArrowDown className="size-3.5" />
            Credit · {entry.method}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {formatDateWithStoredBs(at, entry.created_at_bs)} · by {entry.actor_name}
          </p>
          {entry.note && (
            <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
              "{entry.note}"
            </p>
          )}
        </div>
        <span className="shrink-0 font-display text-lg font-semibold text-success">
          −{NPR(Number(entry.amount))}
        </span>
      </div>
    </li>
  );
}
