import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { TablePagination } from "@/components/common/table-pagination";
import { ExportButtons } from "@/components/common/export-buttons";
import { DateText, EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { useApp } from "@/context/app-store";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { useInvoices } from "@/hooks/useInvoices";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

interface VatRegisterSearch {
  from: string;
  to: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/reports/vat-register")({
  head: () => ({
    meta: [
      { title: "VAT Sales Register — SROTA IMS" },
      {
        name: "description",
        content: "IRD-format VAT register: buyer PAN, taxable amount and VAT per invoice.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): VatRegisterSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: VatRegisterPage,
});

function VatRegisterPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<VatRegisterSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const { invoices: invoiceDtos, meta, isLoading } = useInvoices({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
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
    const customer = app.parties.find((p) => p.id === dto.customer_id);
    return {
      id: dto.id,
      number: dto.number,
      date: dto.date,
      buyer: customer?.name ?? "—",
      buyerPan: customer?.pan ?? "—",
      taxable: Number(dto.taxable_amount),
      vat: Number(dto.vat_amount),
      total: Number(dto.total_amount),
    };
  });

  const totalTaxable = rows.reduce((s, r) => s + r.taxable, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat, 0);

  const exportParams = {
    branch_id: app.branchId === "all" ? undefined : app.branchId,
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
        title="VAT Sales Register"
        subtitle={`${meta?.total ?? rows.length} invoice${(meta?.total ?? rows.length) === 1 ? "" : "s"} — Taxable ${totalTaxable.toFixed(0)}, VAT ${totalVat.toFixed(0)}`}
        actions={<ExportButtons path="/ims/reports/vat-register/export" params={exportParams} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BsDateRangeFilter
          from={search.from}
          to={search.to}
          onFrom={(v) => setSearch({ from: v, page: 1 })}
          onTo={(v) => setSearch({ to: v, page: 1 })}
        />
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState title="No VAT invoices found" description="Adjust the date range." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Invoice</th>
                  <th className="px-3 py-2.5 text-left font-medium">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">Buyer</th>
                  <th className="px-3 py-2.5 text-left font-medium">Buyer PAN</th>
                  <th className="px-3 py-2.5 text-right font-medium">Taxable</th>
                  <th className="px-3 py-2.5 text-right font-medium">VAT</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="num px-3 py-2.5">{r.number}</td>
                    <td className="px-3 py-2.5">
                      <DateText value={r.date} />
                    </td>
                    <td className="px-3 py-2.5">{r.buyer}</td>
                    <td className="num px-3 py-2.5">{r.buyerPan}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={r.taxable} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={r.vat} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      <Money value={r.total} />
                    </td>
                  </tr>
                ))}
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
