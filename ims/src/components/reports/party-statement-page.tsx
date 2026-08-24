import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { TablePagination } from "@/components/common/table-pagination";
import { ExportButtons } from "@/components/common/export-buttons";
import { EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePartyStatementReport } from "@/hooks/useReports";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";

const num = (v: number | string): number => Number(v);

/** Shared presentational body for /reports/customers and /reports/suppliers
 *  — same shape, different `kind`. See stock-report-page.tsx's comment for
 *  why route state is passed in rather than the Route object itself. */
export function PartyStatementPage({
  kind,
  title,
  exportPath,
  q,
  from,
  to,
  page,
  perPage,
  onSearchChange,
}: {
  kind: "customer" | "supplier";
  title: string;
  exportPath: string;
  q: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
  onSearchChange: (patch: {
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    perPage?: number;
  }) => void;
}) {
  const debouncedQ = useDebouncedValue(q, 300);

  const { rows, meta, isLoading } = usePartyStatementReport({
    kind,
    q: debouncedQ || undefined,
    bs_from: from || undefined,
    bs_to: to || undefined,
    page,
    per_page: perPage,
  });

  const totalBalance = rows.reduce((s, r) => s + num(r.balance), 0);

  const exportParams = {
    kind,
    q: debouncedQ || undefined,
    bs_from: from || undefined,
    bs_to: to || undefined,
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
        title={title}
        subtitle={`${meta?.total ?? rows.length} ${kind}${(meta?.total ?? rows.length) === 1 ? "" : "s"} — Total outstanding ${totalBalance.toFixed(0)}`}
        actions={<ExportButtons path={exportPath} params={exportParams} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onSearchChange({ q: e.target.value, page: 1 })}
            placeholder={`Search ${kind} name…`}
            className="pl-8"
          />
        </div>
        <BsDateRangeFilter
          from={from}
          to={to}
          onFrom={(v) => onSearchChange({ from: v, page: 1 })}
          onTo={(v) => onSearchChange({ to: v, page: 1 })}
        />
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState title={`No ${kind}s found`} description="Adjust the search or date range." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Party</th>
                  <th className="px-3 py-2.5 text-left font-medium">PAN</th>
                  <th className="px-3 py-2.5 text-left font-medium">Phone</th>
                  <th className="px-3 py-2.5 text-right font-medium">Period Debit</th>
                  <th className="px-3 py-2.5 text-right font-medium">Period Credit</th>
                  <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.party_id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2.5">{r.name}</td>
                    <td className="num px-3 py-2.5">{r.pan ?? "—"}</td>
                    <td className="num px-3 py-2.5">{r.phone ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={num(r.period_debit)} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={num(r.period_credit)} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      <Money value={num(r.balance)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={meta?.page ?? page}
            perPage={meta?.per_page ?? perPage}
            totalItems={meta?.total ?? rows.length}
            totalPages={meta?.total_pages ?? 1}
            onPageChange={(p) => onSearchChange({ page: p })}
            onPerPageChange={(pp) => onSearchChange({ perPage: pp, page: 1 })}
          />
        </div>
      )}
    </div>
  );
}
