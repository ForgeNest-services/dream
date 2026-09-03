import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { ExportButtons } from "@/components/common/export-buttons";
import { PageHeader } from "@/components/common/primitives";
import { useApp } from "@/context/app-store";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface MonthlyVatSummarySearch {
  from: string;
  to: string;
}

export const Route = createFileRoute("/_app/reports/monthly-vat-summary")({
  head: () => ({
    meta: [
      { title: "Monthly VAT Summary — SROTA IMS" },
      {
        name: "description",
        content: "मासिक — one row per BS month: sales/purchase taxable amounts and net VAT payable.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): MonthlyVatSummarySearch => ({
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
  }),
  component: MonthlyVatSummaryPage,
});

function MonthlyVatSummaryPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<MonthlyVatSummarySearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

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
        title="Monthly VAT Summary"
        subtitle="मासिक — one row per BS month, output VAT minus input VAT."
        actions={
          <ExportButtons path="/ims/reports/monthly-vat-summary/export" params={exportParams} />
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BsDateRangeFilter
          from={search.from}
          to={search.to}
          onFrom={(v) => setSearch({ from: v })}
          onTo={(v) => setSearch({ to: v })}
        />
      </div>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          One row per BS month in the selected range — sales taxable amount and output VAT,
          purchase taxable amount and input VAT, and the net VAT payable for that month. Leave
          the date range empty to include every month on record. Export as XLSX or PDF.
        </p>
      </div>
    </div>
  );
}
