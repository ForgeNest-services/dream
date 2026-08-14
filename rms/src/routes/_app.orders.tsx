import { createFileRoute } from "@tanstack/react-router";
import { OrdersView } from "@/components/pos/OrdersView";
import { usePos } from "@/lib/pos/store";
import { roleShowsNav } from "@/lib/pos/nav";

// URL query params for the orders route. Everything is optional — an empty
// URL renders the default "take order" tab with no filters. Kept as strings
// (except numbers) so links / bookmarks / back-forward all work naturally.
export type OrdersSearch = {
  tab: "take" | "bills";
  q: string;
  // "dues" is a virtual filter — narrows to closed bills paid via khata.
  // Kept in the same field as status so we get one segmented control.
  status: "all" | "draft" | "paid" | "dues";
  bs_from: string;
  bs_to: string;
  page: number;
  per_page: number;
};

const PER_PAGE_ALLOWED = new Set([10, 25, 50, 100]);
const STATUS_ALLOWED: OrdersSearch["status"][] = ["all", "draft", "paid", "dues"];

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Orders — Srota RMS" }] }),
  // TanStack Router uses this to parse the URL into the typed search object.
  // We coerce unknowns into safe defaults instead of throwing — a malformed
  // link shouldn't 500 the page.
  validateSearch: (raw: Record<string, unknown>): OrdersSearch => {
    const tab = raw.tab === "bills" ? "bills" : "take";
    const status: OrdersSearch["status"] = STATUS_ALLOWED.includes(
      raw.status as OrdersSearch["status"],
    )
      ? (raw.status as OrdersSearch["status"])
      : "all";
    const pageNum = Number(raw.page);
    const perPageNum = Number(raw.per_page);
    return {
      tab,
      q: typeof raw.q === "string" ? raw.q : "",
      status,
      bs_from: typeof raw.bs_from === "string" ? raw.bs_from : "",
      bs_to: typeof raw.bs_to === "string" ? raw.bs_to : "",
      page: Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1,
      per_page: PER_PAGE_ALLOWED.has(perPageNum) ? perPageNum : 25,
    };
  },
  component: OrdersRoute,
});

function OrdersRoute() {
  const { session } = usePos();
  // Managers/owners get the extra controls; waiters get the pure order screen.
  const showControls = session ? roleShowsNav(session.role) : false;
  return <OrdersView showControls={showControls} />;
}
