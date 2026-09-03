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

interface Annexure13Search {
  fiscalYearId: string;
  from: string;
  to: string;
}

export const Route = createFileRoute("/_app/reports/annexure-13")({
  head: () => ({
    meta: [
      { title: "Annexure 13 — SROTA IMS" },
      {
        name: "description",
        content: "अनुसूची १३ — combined output/input VAT summary for the selected period.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Annexure13Search => ({
    fiscalYearId: typeof search.fiscalYearId === "string" ? search.fiscalYearId : "all",
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
  }),
  component: Annexure13Page,
});

function Annexure13Page() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<Annexure13Search>) => {
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
        title="Annexure 13"
        subtitle="अनुसूची १३ — output VAT (sales) and input VAT (purchases), net payable for the period."
        actions={<ExportButtons path="/ims/reports/annexure-13/export" params={exportParams} />}
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
          Three rows: Output VAT (Sales), Input VAT (Purchases), and Net VAT Payable /
          (Refundable) — the standard structure IRD expects alongside the monthly return. Set
          the fiscal year and/or date range above, then export as XLSX or PDF.
        </p>
      </div>
    </div>
  );
}
