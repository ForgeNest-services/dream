import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { TablePagination } from "@/components/common/table-pagination";
import { ExportButtons } from "@/components/common/export-buttons";
import { DateText, EmptyState, Money, PageHeader, StatusPill } from "@/components/common/primitives";
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
import { useInvoices } from "@/hooks/useInvoices";
import type { Invoice, InvoiceLine } from "@/data/types";
import type { InvoiceDto } from "@/lib/invoices-api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

interface SalesReportSearch {
  q: string;
  status: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/reports/sales")({
  head: () => ({
    meta: [
      { title: "Sales Report — SROTA IMS" },
      {
        name: "description",
        content: "Every sale with customer, items, taxable amount, VAT and total — filterable, exportable.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): SalesReportSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      status: typeof search.status === "string" ? search.status : "all",
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: SalesReportPage,
});

function dtoToInvoice(i: InvoiceDto): Invoice {
  return {
    id: i.id,
    number: i.number,
    kind: i.kind,
    date: i.date,
    branchId: i.branch_id,
    customerId: i.customer_id,
    lines: i.lines.map(
      (l): InvoiceLine => ({
        id: l.id,
        productId: l.product_id,
        variantId: l.variant_id,
        description: l.description,
        qty: Number(l.qty),
        unitId: l.unit_id,
        rate: Number(l.rate),
        discount: Number(l.discount),
        taxable: l.taxable,
        taxRate: Number(l.tax_rate),
        vatAmount: Number(l.vat_amount),
      }),
    ),
    paymentMethod: i.payment_method as Invoice["paymentMethod"],
    paidAmount: Number(i.paid_amount),
    status: i.status,
    userId: i.user_id,
    note: i.note ?? undefined,
  };
}

function SalesReportPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const setSearch = (patch: Partial<SalesReportSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const debouncedQ = useDebouncedValue(search.q, 300);

  const { invoices: invoiceDtos, meta, isLoading } = useInvoices({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    status: search.status === "all" ? undefined : search.status,
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

  const rows = invoiceDtos.map((dto) => {
    const inv = dtoToInvoice(dto);
    return {
      inv,
      taxable: Number(dto.taxable_amount),
      vat: Number(dto.vat_amount),
      total: Number(dto.total_amount),
    };
  });

  const exportParams = {
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    status: search.status === "all" ? undefined : search.status,
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
        title="Sales Report"
        subtitle={`${meta?.total ?? rows.length} sale${(meta?.total ?? rows.length) === 1 ? "" : "s"} matching the current filters`}
        actions={<ExportButtons path="/ims/reports/sales/export" params={exportParams} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
            placeholder="Search invoice no. or customer"
            className="pl-9"
          />
        </div>
        <Select value={search.status} onValueChange={(v) => setSearch({ status: v, page: 1 })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
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
        <EmptyState title="No sales found" description="Adjust the filters or date range." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th className="px-3 py-2.5 text-left font-medium">Invoice</th>
                  <th className="px-3 py-2.5 text-left font-medium">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-3 py-2.5 text-right font-medium">Items</th>
                  <th className="px-3 py-2.5 text-right font-medium">Taxable</th>
                  <th className="px-3 py-2.5 text-right font-medium">VAT</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expanded = open[r.inv.id] ?? false;
                  return (
                    <Fragment key={r.inv.id}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="pl-2">
                          <button
                            type="button"
                            aria-label={expanded ? "Collapse items" : "Expand items"}
                            onClick={() => setOpen((o) => ({ ...o, [r.inv.id]: !expanded }))}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="num px-3 py-2.5">
                          {r.inv.number}
                          <span className="ml-1.5 text-xs capitalize text-muted-foreground">
                            {r.inv.kind}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <DateText value={r.inv.date} />
                        </td>
                        <td className="px-3 py-2.5">
                          {app.parties.find((p) => p.id === r.inv.customerId)?.name ?? "—"}
                        </td>
                        <td className="num px-3 py-2.5 text-right">{r.inv.lines.length}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={r.taxable} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={r.vat} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium">
                          <Money value={r.total} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={r.inv.status} />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t bg-muted/20">
                          <td />
                          <td colSpan={8} className="px-3 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="py-1 text-left font-medium">Item</th>
                                  <th className="py-1 text-right font-medium">Qty</th>
                                  <th className="py-1 text-right font-medium">Rate</th>
                                  <th className="py-1 text-right font-medium">VAT</th>
                                  <th className="py-1 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.inv.lines.map((l) => (
                                  <tr key={l.id} className="border-t border-border/60">
                                    <td className="py-1.5">
                                      {l.description}
                                      {l.taxable === false && (
                                        <span className="ml-1.5 text-muted-foreground">
                                          (non-taxable)
                                        </span>
                                      )}
                                    </td>
                                    <td className="num py-1.5 text-right">
                                      {l.qty} {app.unitSymbol(l.unitId)}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Money value={l.rate} />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Money value={l.vatAmount ?? 0} />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Money value={(l.rate - l.discount) * l.qty + (l.vatAmount ?? 0)} />
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
