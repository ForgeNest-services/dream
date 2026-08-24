import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { TablePagination } from "@/components/common/table-pagination";
import { ExportButtons } from "@/components/common/export-buttons";
import { DateText, EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { usePurchases } from "@/hooks/usePurchases";
import type { Purchase, PurchaseLine } from "@/data/types";
import type { PurchaseDto } from "@/lib/purchases-api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

interface PurchaseReportSearch {
  q: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/reports/purchases")({
  head: () => ({
    meta: [
      { title: "Purchase Report — SROTA IMS" },
      {
        name: "description",
        content: "Every supplier bill received, with items, cost and VAT breakdown.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): PurchaseReportSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: PurchaseReportPage,
});

function dtoToPurchase(p: PurchaseDto): Purchase {
  return {
    id: p.id,
    number: p.number,
    date: p.date,
    branchId: p.branch_id,
    partyId: p.party_id ?? undefined,
    billNo: p.bill_no ?? undefined,
    lines: p.lines.map(
      (l): PurchaseLine => ({
        id: l.id,
        productId: l.product_id,
        variantId: l.variant_id,
        description: l.description,
        qty: Number(l.qty),
        unitId: l.unit_id,
        unitCost: Number(l.unit_cost),
        taxable: l.taxable,
        taxRate: Number(l.tax_rate),
        vatAmount: Number(l.vat_amount),
      }),
    ),
    itemsTotal: Number(p.items_total),
    billAmount: Number(p.bill_amount),
    paidAmount: Number(p.paid_amount),
    paymentMethod: p.payment_method as Purchase["paymentMethod"],
    postToLedger: p.post_to_ledger,
    note: p.note ?? undefined,
    userId: p.user_id,
  };
}

function PurchaseReportPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const setSearch = (patch: Partial<PurchaseReportSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const debouncedQ = useDebouncedValue(search.q, 300);

  const { purchases: purchaseDtos, meta, isLoading } = usePurchases({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
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

  const rows = purchaseDtos.map(dtoToPurchase);
  const vatTotal = rows.reduce((s, p) => s + p.lines.reduce((x, l) => x + l.vatAmount, 0), 0);

  const exportParams = {
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    q: debouncedQ || undefined,
    bs_from: search.from || undefined,
    bs_to: search.to || undefined,
  };

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-6">
      <div className="mb-2">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
      </div>
      <PageHeader
        title="Purchase Report"
        subtitle={`${meta?.total ?? rows.length} bill${(meta?.total ?? rows.length) === 1 ? "" : "s"} — Total VAT paid ${vatTotal.toFixed(0)}`}
        actions={<ExportButtons path="/ims/reports/purchases/export" params={exportParams} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
            placeholder="Search bill no. or item…"
            className="pl-8"
          />
        </div>
        <BsDateRangeFilter
          from={search.from}
          to={search.to}
          onFrom={(v) => setSearch({ from: v, page: 1 })}
          onTo={(v) => setSearch({ to: v, page: 1 })}
        />
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState title="No purchases found" description="Adjust the filters or date range." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th className="px-3 py-2.5 text-left font-medium">Bill</th>
                  <th className="px-3 py-2.5 text-left font-medium">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">Supplier</th>
                  <th className="px-3 py-2.5 text-right font-medium">Items</th>
                  <th className="px-3 py-2.5 text-right font-medium">Items Total</th>
                  <th className="px-3 py-2.5 text-right font-medium">Bill Amount</th>
                  <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const expanded = open[p.id] ?? false;
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="pl-2">
                          <button
                            type="button"
                            aria-label={expanded ? "Collapse items" : "Expand items"}
                            onClick={() => setOpen((o) => ({ ...o, [p.id]: !expanded }))}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="num font-medium">{p.number}</p>
                          <p className="num text-xs text-muted-foreground">
                            {p.billNo ? `Bill ${p.billNo}` : "No bill no."}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <DateText value={p.date} />
                        </td>
                        <td className="px-3 py-2.5">
                          {app.parties.find((x) => x.id === p.partyId)?.name ?? "Direct"}
                        </td>
                        <td className="num px-3 py-2.5 text-right">{p.lines.length}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={p.itemsTotal} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={p.billAmount || p.itemsTotal} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={p.paidAmount} />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t bg-muted/20">
                          <td />
                          <td colSpan={7} className="px-3 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="py-1 text-left font-medium">Item</th>
                                  <th className="py-1 text-right font-medium">Qty</th>
                                  <th className="py-1 text-right font-medium">Unit Cost</th>
                                  <th className="py-1 text-right font-medium">VAT</th>
                                  <th className="py-1 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.lines.map((l) => (
                                  <tr key={l.id} className="border-t border-border/60">
                                    <td className="py-1.5">
                                      {l.description}
                                      {!l.taxable && (
                                        <span className="ml-1.5 text-muted-foreground">
                                          (non-taxable)
                                        </span>
                                      )}
                                    </td>
                                    <td className="num py-1.5 text-right">
                                      {l.qty} {app.unitSymbol(l.unitId)}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Money value={l.unitCost} />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {l.taxable ? <Money value={l.vatAmount} /> : "—"}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Money value={l.qty * l.unitCost + l.vatAmount} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
    </div>
  );
}
