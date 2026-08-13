import { DatePicker } from "@/components/common/date-picker";
import { PaginationBar, usePagination } from "@/components/common/pagination";
import { DateText, EmptyState, Money, PageHeader, Qty } from "@/components/common/primitives";
import { AdjustStockDialog, RestockDialog } from "@/components/inventory/stock-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import type { MovementType } from "@/data/types";
import { downloadCsv } from "@/lib/csv";
import { formatAd, formatBs } from "@/lib/nepali-date";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Download, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_app/inventory/movements")({
  head: () => ({
    meta: [
      { title: "Stock Movements — SROTA IMS" },
      {
        name: "description",
        content:
          "Dated ledger of every restock, adjustment, sale and transfer with running balances per branch.",
      },
      { property: "og:title", content: "Stock Movements — SROTA IMS" },
      {
        property: "og:description",
        content: "Full audit trail of stock in and out, filterable by BS or AD date range.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MovementsPage,
});

const TYPE_LABEL: Record<MovementType, string> = {
  restock: "Restock",
  "adjust-in": "Adjust +",
  "adjust-out": "Adjust −",
  sale: "Sale",
  transfer: "Transfer",
};

function MovementsPage() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return app.movements.filter((m) => {
      if (app.branchId !== "all" && m.branchId !== app.branchId) return false;
      if (type !== "all" && m.type !== type) return false;
      if (from && new Date(m.date) < new Date(from)) return false;
      if (to && new Date(m.date) > new Date(new Date(to).setHours(23, 59, 59))) return false;
      if (!term) return true;
      const p = app.products.find((x) => x.id === m.productId);
      const v = app.variants.find((x) => x.id === m.variantId);
      return `${p?.name ?? ""} ${v?.name ?? ""} ${m.reference ?? ""} ${m.reason ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [app.movements, app.branchId, app.products, app.variants, q, type, from, to]);

  const { page, setPage, pageCount, slice, total, pageSize } = usePagination(rows, 15);

  const inQty = rows.filter((m) => m.qty > 0).reduce((s, m) => s + m.qty, 0);
  const outQty = rows.filter((m) => m.qty < 0).reduce((s, m) => s - m.qty, 0);

  const exportCsv = () =>
    downloadCsv(
      "stock-movements",
      rows.map((m) => ({
        date_bs: formatBs(new Date(m.date)),
        date_ad: formatAd(new Date(m.date)),
        branch: app.branches.find((b) => b.id === m.branchId)?.name ?? "",
        product: app.products.find((p) => p.id === m.productId)?.name ?? "",
        variant: app.variants.find((v) => v.id === m.variantId)?.name ?? "",
        type: TYPE_LABEL[m.type],
        qty: m.qty,
        balance: m.balanceAfter,
        unit_cost: m.unitCost ?? "",
        reference: m.reference ?? m.reason ?? "",
        user: app.users.find((u) => u.id === m.userId)?.name ?? "",
      })),
    );

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        subtitle={`${rows.length} entries · ${inQty} in · ${outQty} out`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            {app.can("stock.restock") ? (
              <Button variant="outline" size="sm" onClick={() => setRestockOpen(true)}>
                <PackagePlus className="mr-1.5 h-4 w-4" /> Restock
              </Button>
            ) : null}
            {app.can("stock.adjust") ? (
              <Button size="sm" onClick={() => setAdjustOpen(true)}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Adjust stock
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search product, reference or reason…"
            className="pl-8"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(TYPE_LABEL) as MovementType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePicker value={from} onChange={setFrom} placeholder="From date" />
        <DatePicker value={to} onChange={setTo} placeholder="To date" />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No movements found" description="Adjust the filters or date range." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">Branch</th>
                  <th className="px-3 py-2.5 text-left font-medium">Product</th>
                  <th className="px-3 py-2.5 text-left font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                  <th className="px-3 py-2.5 text-right font-medium">Unit cost</th>
                  <th className="px-3 py-2.5 text-left font-medium">Ref / reason</th>
                  <th className="px-3 py-2.5 text-left font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((m) => {
                  const p = app.products.find((x) => x.id === m.productId);
                  const v = app.variants.find((x) => x.id === m.variantId);
                  return (
                    <tr key={m.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <DateText value={m.date} withAlt />
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {app.branches.find((b) => b.id === m.branchId)?.code}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{p?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{v?.name}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            m.type === "restock" && "bg-success/12 text-success",
                            m.type === "sale" && "bg-info/12 text-info",
                            m.type === "adjust-in" && "bg-accent/15 text-accent-foreground",
                            m.type === "adjust-out" && "bg-warning/15 text-warning",
                            m.type === "transfer" && "bg-muted text-muted-foreground",
                          )}
                        >
                          {TYPE_LABEL[m.type]}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right",
                          m.qty >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        <Qty value={m.qty} unit={app.unitSymbol(v?.unitId ?? "")} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Qty value={m.balanceAfter} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {m.unitCost ? <Money value={m.unitCost} /> : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {m.reference ?? m.reason ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {app.users.find((u) => u.id === m.userId)?.name ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
          />
        </div>
      )}

      <AdjustStockDialog open={adjustOpen} onOpenChange={setAdjustOpen} />
      <RestockDialog open={restockOpen} onOpenChange={setRestockOpen} />
    </div>
  );
}
