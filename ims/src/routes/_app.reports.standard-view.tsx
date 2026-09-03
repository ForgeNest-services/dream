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

interface StandardViewSearch {
  fiscalYearId: string;
  from: string;
  to: string;
}

export const Route = createFileRoute("/_app/reports/standard-view")({
  head: () => ({
    meta: [
      { title: "Standard View — SROTA IMS" },
      {
        name: "description",
        content: "अनुसूची ५ — all 20 mandatory fields, every invoice in the period.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): StandardViewSearch => ({
    fiscalYearId: typeof search.fiscalYearId === "string" ? search.fiscalYearId : "all",
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
  }),
  component: StandardViewPage,
});

function StandardViewPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<StandardViewSearch>) => {
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
        title="Standard View"
        subtitle="अनुसूची ५ — every mandatory field, every invoice in the period."
        actions={<ExportButtons path="/ims/reports/standard-view/export" params={exportParams} />}
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
          One row per invoice — bill number, date, buyer/seller PAN, VAT breakdown, print
          status, and who entered/printed it. Applies to every invoice regardless of VAT
          registration status. Quotations and credit notes are excluded (credit notes have
          their own register, below). Export as XLSX or PDF.
        </p>
      </div>
    </div>
  );
}
