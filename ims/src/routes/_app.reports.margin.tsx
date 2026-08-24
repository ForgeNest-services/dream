import { BsDateRangeFilter } from "@/components/common/bs-date-picker";
import { TablePagination } from "@/components/common/table-pagination";
import { ExportButtons } from "@/components/common/export-buttons";
import { EmptyState, Money, PageHeader } from "@/components/common/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { useMarginReport } from "@/hooks/useReports";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const num = (v: number | string): number => Number(v);

interface MarginSearch {
  categoryId: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/reports/margin")({
  head: () => ({
    meta: [
      { title: "Profit Margin — SROTA IMS" },
      {
        name: "description",
        content: "Revenue, cost and margin % per variant, ranked highest revenue first.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): MarginSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      categoryId: typeof search.categoryId === "string" ? search.categoryId : "all",
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: MarginReportPage,
});

function MarginReportPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<MarginSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const { rows, meta, isLoading } = useMarginReport({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    category_id: search.categoryId === "all" ? undefined : search.categoryId,
    bs_from: search.from || undefined,
    bs_to: search.to || undefined,
    page: search.page,
    per_page: search.perPage,
  });

  const totalRevenue = rows.reduce((s, r) => s + num(r.revenue), 0);
  const totalProfit = rows.reduce((s, r) => s + num(r.profit), 0);

  const exportParams = {
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    category_id: search.categoryId === "all" ? undefined : search.categoryId,
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
        title="Profit Margin"
        subtitle={`${meta?.total ?? rows.length} variant${(meta?.total ?? rows.length) === 1 ? "" : "s"} sold — Revenue ${totalRevenue.toFixed(0)}, Profit ${totalProfit.toFixed(0)}`}
        actions={<ExportButtons path="/ims/reports/margin/export" params={exportParams} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={search.categoryId}
          onValueChange={(v) => setSearch({ categoryId: v, page: 1 })}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All categories</SelectItem>
            {app.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {app.categoryPath(c.id)}
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
        <EmptyState title="No sales to report" description="Widen the date range or category." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Product</th>
                  <th className="px-3 py-2.5 text-left font-medium">Variant</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty Sold</th>
                  <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-3 py-2.5 text-right font-medium">Profit</th>
                  <th className="px-3 py-2.5 text-right font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const revenue = num(r.revenue);
                  const profit = num(r.profit);
                  const marginPct = num(r.margin_pct);
                  return (
                    <tr key={r.variant_id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2.5">{r.product_name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.variant_name}</td>
                      <td className="num px-3 py-2.5 text-right">{r.qty_sold}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Money value={revenue} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Money value={num(r.cost)} />
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-medium ${profit < 0 ? "text-destructive" : ""}`}
                      >
                        <Money value={profit} />
                      </td>
                      <td className="num px-3 py-2.5 text-right">{marginPct.toFixed(1)}%</td>
                    </tr>
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
