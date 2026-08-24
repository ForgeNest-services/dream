import { StockReportPage } from "@/components/reports/stock-report-page";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { createFileRoute } from "@tanstack/react-router";

interface StockSearch {
  q: string;
  categoryId: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/reports/stock")({
  head: () => ({
    meta: [
      { title: "Stock Summary — SROTA IMS" },
      {
        name: "description",
        content: "On-hand quantity, cost value and retail value per variant, by category and branch.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): StockSearch => {
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
  component: StockPage,
});

function StockPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <StockReportPage
      lowStockOnly={false}
      title="Stock Summary"
      exportPath="/ims/reports/stock-summary/export"
      q={search.q}
      categoryId={search.categoryId}
      page={search.page}
      perPage={search.perPage}
      onSearchChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) })}
    />
  );
}
