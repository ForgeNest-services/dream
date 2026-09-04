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
import { ArrowLeft } from "lucide-react";

interface CreditNotesSearch {
  fiscalYearId: string;
  from: string;
  to: string;
}

export const Route = createFileRoute("/_app/reports/credit-notes")({
  head: () => ({
    meta: [
      { title: "Credit Notes — SROTA IMS" },
      {
        name: "description",
        content: "Every credit note issued in the period, with its reference invoice.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): CreditNotesSearch => ({
    fiscalYearId: typeof search.fiscalYearId === "string" ? search.fiscalYearId : "all",
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
  }),
  component: CreditNotesPage,
});

function CreditNotesPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<CreditNotesSearch>) => {
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
        title="Credit Notes"
        subtitle="Credit notes issued in the period with their reference invoice."
        actions={<ExportButtons path="/ims/reports/credit-notes/export" params={exportParams} />}
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
          One row per credit note — credit note number, date, the invoice it reverses, reason,
          and the reversed VAT breakdown. Required for CBMS /api/billreturn reconciliation.
          Export as XLSX or PDF.
        </p>
      </div>
    </div>
  );
}
