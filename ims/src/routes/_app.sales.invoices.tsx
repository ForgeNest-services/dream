import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { TablePagination } from "@/components/common/table-pagination";
import { DateText, EmptyState, Money, PageHeader, StatusPill } from "@/components/common/primitives";
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
import { useInvoices } from "@/hooks/useInvoices";
import type { Invoice, InvoiceLine } from "@/data/types";
import type { InvoiceDto } from "@/lib/invoices-api";
import { downloadCsv } from "@/lib/csv";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";

interface InvoicesSearch {
  q: string;
  status: string;
  fiscalYearId: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/sales/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — SROTA IMS" },
      {
        name: "description",
        content:
          "All tax and abbreviated invoices with VAT breakdown, payment status, branch and Bikram Sambat date filters.",
      },
      { property: "og:title", content: "Invoices — SROTA IMS" },
      {
        property: "og:description",
        content: "IRD-compliant invoice register with VAT breakdown and payment status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): InvoicesSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 12,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      status: typeof search.status === "string" ? search.status : "all",
      fiscalYearId: typeof search.fiscalYearId === "string" ? search.fiscalYearId : "all",
      // Bikram Sambat "YYYY-MM-DD" strings, sent straight through to the
      // backend's bs_from/bs_to (see IMSInvoice.date_bs).
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: InvoicesPage,
});

// Backend Decimal fields serialize as JSON strings — coerce before arithmetic.
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

function InvoicesPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<InvoicesSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const debouncedQ = useDebouncedValue(search.q, 300);

  const { invoices: invoiceDtos, meta, isLoading } = useInvoices({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    status: search.status === "all" ? undefined : search.status,
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

  const rows = invoiceDtos.map((dto) => {
    const inv = dtoToInvoice(dto);
    return {
      inv,
      taxable: Number(dto.taxable_amount),
      vat: Number(dto.vat_amount),
      total: Number(dto.total_amount),
    };
  });

  const exportCsv = () =>
    downloadCsv(
      "invoices",
      rows.map((r) => ({
        number: r.inv.number,
        date: r.inv.date.slice(0, 10),
        customer: app.parties.find((p) => p.id === r.inv.customerId)?.name ?? "",
        taxable: r.taxable.toFixed(2),
        vat: r.vat.toFixed(2),
        total: r.total.toFixed(2),
        paid: r.inv.paidAmount.toFixed(2),
        status: r.inv.status,
      })),
    );

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${meta?.total ?? rows.length} document${(meta?.total ?? rows.length) === 1 ? "" : "s"} in the current branch and date range`}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        }
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
        <EmptyState title="No invoices found" description="Adjust the filters or make a sale." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Invoice</th>
                <th className="px-3 py-2.5 text-left font-medium">Date</th>
                <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                <th className="px-3 py-2.5 text-right font-medium">Taxable</th>
                <th className="px-3 py-2.5 text-right font-medium">VAT</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 text-right font-medium">Due</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cust = app.parties.find((p) => p.id === r.inv.customerId);
                return (
                  <tr key={r.inv.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="num px-3 py-2.5">
                      {r.inv.number}
                      <span className="ml-1.5 text-xs capitalize text-muted-foreground">
                        {r.inv.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <DateText value={r.inv.date} />
                    </td>
                    <td className="px-3 py-2.5">{cust?.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={r.taxable} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={r.vat} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={r.total} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={Math.max(0, r.total - r.inv.paidAmount)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={r.inv.status} />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/print/$invoiceId" params={{ invoiceId: r.inv.id }}>
                          <Printer className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
