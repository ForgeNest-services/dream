import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { ExportButtons } from "@/components/common/export-buttons";
import { PageHeader } from "@/components/common/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Info } from "lucide-react";

interface TdsSearch {
  fiscalYearId: string;
  from: string;
  to: string;
}

export const Route = createFileRoute("/_app/reports/tds")({
  head: () => ({
    meta: [
      { title: "TDS Report — SROTA IMS" },
      {
        name: "description",
        content: "Tax Deducted at Source on supplier purchases for the selected period.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): TdsSearch => ({
    fiscalYearId: typeof search.fiscalYearId === "string" ? search.fiscalYearId : "all",
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
  }),
  component: TdsReportPage,
});

function TdsReportPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<TdsSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const exportParams = {
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    fiscal_year_id: search.fiscalYearId === "all" ? undefined : search.fiscalYearId,
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
        title="TDS Report"
        subtitle="Tax Deducted at Source — every supplier bill in the period."
        actions={<ExportButtons path="/ims/reports/tds/export" params={exportParams} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={search.fiscalYearId}
          onValueChange={(v) => setSearch({ fiscalYearId: v })}
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
          onFrom={(v) => setSearch({ from: v })}
          onTo={(v) => setSearch({ to: v })}
        />
      </div>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          One row per supplier bill — supplier name and PAN, bill amount, TDS rate and TDS
          amount. Export as XLSX or PDF.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            IMS doesn&apos;t track a per-purchase TDS rate yet, so TDS Rate and TDS Amount export
            as 0 until that&apos;s recorded at purchase-entry time. If TDS applies to your
            suppliers, don&apos;t submit this report as-is — the bill amounts are correct, but
            the TDS columns aren&apos;t.
          </p>
        </div>
      </div>
    </div>
  );
}
