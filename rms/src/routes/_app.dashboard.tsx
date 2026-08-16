import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/pos/DashboardView";

// Optional ?bs=YYYY-MM-DD lets managers view a historical day's dashboard
// (e.g. reconciling yesterday's cash before opening the till). Empty string
// means "today" — resolved at render time so bookmarks always mean "today"
// rather than freezing to whatever today was when the URL was saved.
export type DashboardSearch = {
  bs: string;
};

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Srota RMS" }] }),
  validateSearch: (raw: Record<string, unknown>): DashboardSearch => ({
    bs: typeof raw.bs === "string" ? raw.bs : "",
  }),
  component: DashboardView,
});
