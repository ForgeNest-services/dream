import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NPR, type Customer } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { formatDateWithStoredBs, parseApiDate } from "@/lib/pos/nepali-date";
import {
  customersApi,
  type CustomerHistoryDto,
  type CustomerOrderEntryDto,
  type KhataHistoryDto,
  type KhataSettlementDto,
} from "@/lib/customers-api";

// Unified timeline row — an attached order OR a khata settlement, sorted
// newest-first. Orders come from /history (all payment methods, all
// statuses); settlements come from /khata-history (credit side of the
// khata ledger). Merged so the customer's activity reads as one story.
type TimelineItem =
  | { kind: "order"; at: number; entry: CustomerOrderEntryDto }
  | { kind: "settlement"; at: number; entry: KhataSettlementDto };

export function CustomerDetailDialog({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const { branchId } = usePos();
  const [history, setHistory] = useState<CustomerHistoryDto | null>(null);
  const [khata, setKhata] = useState<KhataHistoryDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);
    // Both calls fire in parallel — /history for the full order list,
    // /khata-history for settlements (which /history doesn't include, since
    // settlements aren't orders). Both share the same customer scope so
    // failure on either is a hard error, not partial rendering.
    Promise.all([
      customersApi.history(branchId, customer.id),
      customersApi.khataHistory(branchId, customer.id),
    ])
      .then(([h, k]) => {
        if (cancelled) return;
        setHistory(h.data ?? null);
        setKhata(k.data ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, customer.id]);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    if (history) {
      for (const o of history.orders) {
        items.push({
          kind: "order",
          at: parseApiDate(o.placed_at)?.getTime() ?? 0,
          entry: o,
        });
      }
    }
    if (khata) {
      for (const s of khata.settlements) {
        items.push({
          kind: "settlement",
          at: parseApiDate(s.created_at)?.getTime() ?? 0,
          entry: s,
        });
      }
    }
    return items.sort((a, b) => b.at - a.at);
  }, [history, khata]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {customer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground">
          {customer.phone && <span>{customer.phone}</span>}
          {customer.phone && customer.address && <span> · </span>}
          {customer.address && <span>{customer.address}</span>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Total orders"
            value={history ? String(history.total_orders) : "—"}
          />
          <StatCard
            label="Total spent"
            value={history ? NPR(Number(history.total_spent)) : "—"}
            hint="Closed bills"
            tone="primary"
          />
          <StatCard
            label="Outstanding"
            value={history ? NPR(Number(history.outstanding_balance)) : "—"}
            tone={
              history && Number(history.outstanding_balance) > 0
                ? "warning"
                : "muted"
            }
            hint="On khata"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading history…
          </div>
        )}

        {!loading && timeline.length === 0 && (
          <p className="rounded-xl bg-secondary p-6 text-center text-sm text-muted-foreground">
            No activity yet — attach this customer to an order and it'll show up here.
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
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warning" | "primary" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning bg-warning/10 text-navy"
      : tone === "primary"
        ? "border-primary/40 bg-primary/5 text-primary"
        : "border-border bg-secondary/60 text-foreground";
  return (
    <div className={`rounded-xl border-2 p-3 ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 font-display text-base font-semibold leading-tight sm:text-lg">
        {value}
      </p>
      {hint && <p className="text-[10px] opacity-70">{hint}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<CustomerOrderEntryDto["status"], string> = {
  draft: "bg-primary/15 text-primary",
  paid: "bg-success/15 text-success",
  cancelled: "bg-danger/15 text-danger",
};

const STATUS_LABEL: Record<CustomerOrderEntryDto["status"], string> = {
  draft: "Running",
  paid: "Closed",
  cancelled: "Cancelled",
};

function OrderRow({ entry }: { entry: CustomerOrderEntryDto }) {
  const placedTs = parseApiDate(entry.placed_at)?.getTime() ?? 0;
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold">
              <Receipt className="size-3.5 opacity-60" />
              {entry.bill_code ?? `#${entry.bill_number}`}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[entry.status]}`}
            >
              {STATUS_LABEL[entry.status]}
            </span>
            {entry.payment_method && (
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {entry.payment_method}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              · {entry.type === "delivery" ? "Delivery" : "Dine-in"} ·{" "}
              {entry.line_count} item{entry.line_count === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {formatDateWithStoredBs(placedTs, entry.placed_at_bs)}
          </p>
        </div>
        <span className="shrink-0 font-display text-base font-semibold">
          {NPR(Number(entry.total))}
        </span>
      </div>
    </li>
  );
}

function SettlementRow({ entry }: { entry: KhataSettlementDto }) {
  const at = parseApiDate(entry.created_at)?.getTime() ?? 0;
  return (
    <li className="rounded-xl border border-success/40 bg-success/5 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-success">
            <ArrowDown className="size-3.5" />
            Khata payment · {entry.method}
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
        <span className="shrink-0 font-display text-base font-semibold text-success">
          −{NPR(Number(entry.amount))}
        </span>
      </div>
    </li>
  );
}
