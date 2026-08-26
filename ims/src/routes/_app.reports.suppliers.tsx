import { PartyStatementPage } from "@/components/reports/party-statement-page";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { createFileRoute } from "@tanstack/react-router";

interface SupplierStatementSearch {
  q: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/reports/suppliers")({
  head: () => ({
    meta: [
      { title: "Supplier Statement — SROTA IMS" },
      {
        name: "description",
        content: "Every supplier's outstanding balance and activity in the selected period.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): SupplierStatementSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: SupplierStatementPage,
});

function SupplierStatementPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <PartyStatementPage
      kind="supplier"
      title="Supplier Statement"
      exportPath="/ims/reports/party-statement/export"
      q={search.q}
      from={search.from}
      to={search.to}
      page={search.page}
      perPage={search.perPage}
      onSearchChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) })}
    />
  );
}
