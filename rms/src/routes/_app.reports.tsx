import { createFileRoute } from "@tanstack/react-router";
import { ReportsView } from "@/components/pos/ReportsView";

// Everything is URL-driven so shared/bookmarked links open the same view.
// Defaults: last-7-day range (empty → resolved to today−6..today at mount),
// tab "orders", status/type "all". Filters get sanitized in validateSearch —
// a malformed link falls back to defaults instead of throwing.
export type ReportsSearch = {
  tab: "orders" | "category" | "items" | "activity" | "ird";
  bs_from: string;
  bs_to: string;
  status: "all" | "draft" | "paid";
  type: "all" | "dine-in" | "delivery";
};

const TABS: ReportsSearch["tab"][] = ["orders", "category", "items", "activity", "ird"];
const STATUSES: ReportsSearch["status"][] = ["all", "draft", "paid"];
const TYPES: ReportsSearch["type"][] = ["all", "dine-in", "delivery"];

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — Srota RMS" }] }),
  validateSearch: (raw: Record<string, unknown>): ReportsSearch => {
    const tab = TABS.includes(raw.tab as ReportsSearch["tab"])
      ? (raw.tab as ReportsSearch["tab"])
      : "orders";
    const status = STATUSES.includes(raw.status as ReportsSearch["status"])
      ? (raw.status as ReportsSearch["status"])
      : "all";
    const type = TYPES.includes(raw.type as ReportsSearch["type"])
      ? (raw.type as ReportsSearch["type"])
      : "all";
    return {
      tab,
      bs_from: typeof raw.bs_from === "string" ? raw.bs_from : "",
      bs_to: typeof raw.bs_to === "string" ? raw.bs_to : "",
      status,
      type,
    };
  },
  component: ReportsView,
});
