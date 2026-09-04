import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { TablePagination } from "@/components/common/table-pagination";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { useMovements } from "@/hooks/useMovements";
import type { MovementType, StockMovement } from "@/data/types";
import type { StockMovementDto } from "@/lib/stock-api";
import { downloadCsv } from "@/lib/csv";
import { formatAd, formatBs } from "@/lib/nepali-date";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Download, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

interface MovementsSearch {
  q: string;
  type: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
}

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
        content: "Full audit trail of stock in and out, filterable by Bikram Sambat date range.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): MovementsSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      type: typeof search.type === "string" ? search.type : "all",
      // Bikram Sambat "YYYY-MM-DD" strings, sent straight through to the
      // backend's bs_from/bs_to (see IMSStockMovement.date_bs).
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: MovementsPage,
});

const TYPE_LABEL: Record<MovementType, string> = {
  restock: "Restock",
  "adjust-in": "Adjust +",
  "adjust-out": "Adjust −",
  sale: "Sale",
  transfer: "Transfer",
  return: "Return",
};

function dtoToMovement(m: StockMovementDto): StockMovement {
  return {
    id: m.id,
    date: m.date,
    branchId: m.branch_id,
    productId: m.product_id,
    variantId: m.variant_id,
    type: m.type,
    qty: Number(m.qty),
    unitCost: m.unit_cost == null ? undefined : Number(m.unit_cost),
    balanceAfter: Number(m.balance_after),
    reason: m.reason ?? undefined,
    reference: m.reference ?? undefined,
    supplierId: m.supplier_id ?? undefined,
    userId: m.user_id,
    userName: m.user_name,
  };
}

function MovementsPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<MovementsSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);

  const debouncedQ = useDebouncedValue(search.q, 300);

  const { movements: movementDtos, meta, isLoading, refetch } = useMovements({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    type: search.type === "all" ? undefined : search.type,
    q: debouncedQ || undefined,
    bs_from: search.from || undefined,
    bs_to: search.to || undefined,
    page: search.page,
    per_page: search.perPage,
  });

  useEffect(() => {
    if (meta && search.page > meta.total_pages) {
      setSearch({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.total_pages]);

  const rows = movementDtos.map(dtoToMovement);

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
        user: m.userName ?? "",
      })),
    );

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        subtitle={`${meta?.total ?? rows.length} entries · ${inQty} in · ${outQty} out (this page)`}
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
            value={search.q}
            onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
            placeholder="Search product, reference or reason…"
            className="pl-8"
          />
        </div>
        <Select value={search.type} onValueChange={(v) => setSearch({ type: v, page: 1 })}>
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
        <BsDateRangeFilter
          from={search.from}
          to={search.to}
          onFrom={(v) => setSearch({ from: v, page: 1 })}
          onTo={(v) => setSearch({ to: v, page: 1 })}
        />
      </div>

      {!isLoading && rows.length === 0 ? (
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
                {rows.map((m) => {
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
                            m.type === "return" && "bg-success/12 text-success",
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
                        {m.userName ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={meta?.page ?? search.page}
            perPage={meta?.per_page ?? search.perPage}
            totalItems={meta?.total ?? rows.length}
            totalPages={meta?.total_pages ?? 1}
            onPageChange={(p) => setSearch({ page: p })}
            onPerPageChange={(pp) => setSearch({ perPage: pp, page: 1 })}
          />
        </div>
      )}

      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={(o) => {
          setAdjustOpen(o);
          if (!o) refetch();
        }}
      />
      <RestockDialog
        open={restockOpen}
        onOpenChange={(o) => {
          setRestockOpen(o);
          if (!o) refetch();
        }}
      />
    </div>
  );
}
