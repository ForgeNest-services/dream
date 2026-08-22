import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { TablePagination } from "@/components/common/table-pagination";
import { DateText, EmptyState, Money, PageHeader } from "@/components/common/primitives";
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
import { usePurchases } from "@/hooks/usePurchases";
import type { Purchase, PurchaseLine } from "@/data/types";
import type { PurchaseDto } from "@/lib/purchases-api";
import { downloadCsv } from "@/lib/csv";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

interface PurchaseBillsSearch {
  q: string;
  partyId: string;
  fiscalYearId: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/purchase/bills")({
  head: () => ({
    meta: [
      { title: "Purchase Bills — SROTA IMS" },
      {
        name: "description",
        content:
          "Register of supplier purchase bills with items received, bill amount, payments made and outstanding balance per party.",
      },
      { property: "og:title", content: "Purchase Bills — SROTA IMS" },
      {
        property: "og:description",
        content: "Supplier purchase register with items, payments and ledger status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): PurchaseBillsSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 10,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      partyId: typeof search.partyId === "string" ? search.partyId : "all",
      fiscalYearId: typeof search.fiscalYearId === "string" ? search.fiscalYearId : "all",
      // Bikram Sambat "YYYY-MM-DD" strings, sent straight through to the
      // backend's bs_from/bs_to (see IMSPurchase.date_bs) — no AD conversion
      // anywhere in this filter path.
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: PurchaseBillsPage,
});

// Backend Decimal fields serialize as JSON strings — coerce before arithmetic.
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

function PurchaseBillsPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<PurchaseBillsSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const debouncedQ = useDebouncedValue(search.q, 300);

  const { purchases: purchaseDtos, meta, isLoading } = usePurchases({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    party_id: search.partyId === "all" ? undefined : search.partyId,
    fiscal_year_id: search.fiscalYearId === "all" ? undefined : search.fiscalYearId,
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

  const exportCsv = () =>
    downloadCsv(
      "purchase-bills",
      rows.map((pu) => ({
        number: pu.number,
        billNo: pu.billNo ?? "",
        date: pu.date,
        party: app.parties.find((p) => p.id === pu.partyId)?.name ?? "—",
        items: pu.lines.length,
        itemsTotal: pu.itemsTotal,
        billAmount: pu.billAmount,
        paid: pu.paidAmount,
      })),
    );

  return (
    <div>
      <PageHeader
        title="Purchase Bills"
        subtitle={`${meta?.total ?? rows.length} recorded purchase entries`}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        }
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
        <Select value={search.partyId} onValueChange={(v) => setSearch({ partyId: v, page: 1 })}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All parties</SelectItem>
            {app.parties
              .filter((p) => p.kind === "supplier")
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={search.fiscalYearId}
          onValueChange={(v) => setSearch({ fiscalYearId: v, page: 1 })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fiscal years</SelectItem>
            {app.fiscalYears.map((f) => (
              <SelectItem key={f.id} value={f.id} className="num">
                {f.label}
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
        <EmptyState
          title="No purchase bills yet"
          description="Record a supplier bill from the New Purchase tab — stock and ledger post together."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th className="px-3 py-2.5 text-left font-medium">Entry</th>
                  <th className="px-3 py-2.5 text-left font-medium">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">Party</th>
                  <th className="px-3 py-2.5 text-right font-medium">Items</th>
                  <th className="px-3 py-2.5 text-right font-medium">Bill amount</th>
                  <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                  <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pu) => {
                  const expanded = open[pu.id] ?? false;
                  return (
                    <Fragment key={pu.id}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="pl-2">
                          <button
                            type="button"
                            aria-label={expanded ? "Collapse items" : "Expand items"}
                            onClick={() => setOpen((o) => ({ ...o, [pu.id]: !expanded }))}
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
                          <p className="num font-medium">{pu.number}</p>
                          <p className="num text-xs text-muted-foreground">
                            {pu.billNo ? `Bill ${pu.billNo}` : "No bill no."}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <DateText value={pu.date} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {app.parties.find((p) => p.id === pu.partyId)?.name ?? "—"}
                          {pu.partyId && !pu.postToLedger ? " (not tracked)" : ""}
                        </td>
                        <td className="num px-3 py-2.5 text-right">{pu.lines.length}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={pu.billAmount || pu.itemsTotal} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={pu.paidAmount} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={Math.max(0, (pu.billAmount || pu.itemsTotal) - pu.paidAmount)} />
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
                                  <th className="py-1 text-right font-medium">Unit cost</th>
                                  <th className="py-1 text-right font-medium">Amount</th>
                                  <th className="py-1 text-right font-medium">VAT</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pu.lines.map((l) => (
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
                                      <Money value={l.qty * l.unitCost} />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {l.taxable ? <Money value={l.vatAmount} /> : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t font-medium">
                                  <td className="py-1.5" colSpan={3}>
                                    VAT total
                                  </td>
                                  <td />
                                  <td className="py-1.5 text-right">
                                    <Money value={pu.lines.reduce((s, l) => s + l.vatAmount, 0)} />
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            {pu.note ? (
                              <p className="mt-2 text-xs text-muted-foreground">{pu.note}</p>
                            ) : null}
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
