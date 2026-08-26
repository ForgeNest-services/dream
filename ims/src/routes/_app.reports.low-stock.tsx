import { StockReportPage } from "@/components/reports/stock-report-page";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { createFileRoute } from "@tanstack/react-router";

interface LowStockSearch {
  q: string;
  categoryId: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/reports/low-stock")({
  head: () => ({
    meta: [
      { title: "Low Stock — SROTA IMS" },
      {
        name: "description",
        content: "Variants at or below their reorder threshold.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): LowStockSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      categoryId: typeof search.categoryId === "string" ? search.categoryId : "all",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: LowStockPage,
});

function LowStockPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <StockReportPage
      lowStockOnly
      title="Low Stock"
      exportPath="/ims/reports/stock-summary/export"
      q={search.q}
      categoryId={search.categoryId}
      page={search.page}
      perPage={search.perPage}
      onSearchChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) })}
    />
  );
}
