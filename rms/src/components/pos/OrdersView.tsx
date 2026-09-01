import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Search, X } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NPR, type Order, type RestaurantTable } from "@/lib/pos/data";
import { billTotals, usePos } from "@/lib/pos/store";
import { formatDateWithStoredBs, parseApiDate, toBsIso } from "@/lib/pos/nepali-date";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useOrdersList } from "@/hooks/useOrdersList";
import { ordersApi, type OrderDto } from "@/lib/orders-api";
import type { OrdersSearch } from "@/routes/_app.orders";
import { OrderScreen } from "./OrderScreen";
import { ReserveDialog, TableGrid } from "./TableGrid";
import { BillReceipt, PrintDialog } from "./ThermalPrint";
import { BsDatePicker } from "./BsDatePicker";

// Route ref for the URL-synced search params. Using the hook-with-`from`
// form (instead of importing the Route object from `_app.orders`) sidesteps
// a circular-import HMR flash where the child component briefly saw an
// undefined Route and the router fell through to the 404 page.
const ORDERS_ROUTE = "/_app/orders" as const;

type Tab = "take" | "bills";

export function OrdersView({ showControls = false }: { showControls?: boolean }) {
  const { tables } = usePos();
  // URL is the source of truth — refresh preserves tab + all filters,
  // links are shareable, back/forward works.
  //
  // `useSearch({ from })` is a typed read only. `useNavigate()` is called
  // WITHOUT `from` on purpose — passing `from` there makes the router treat
  // the route ID as the navigation target, and since our route ID is
  // "/_app/orders" (with the pathless `_app` prefix) that produces a
  // literal /_app/orders URL which doesn't match any route → 404.
  const search = useSearch({ from: ORDERS_ROUTE });
  const navigate = useNavigate();
  const setTab = (tab: Tab) =>
    navigate({ search: (prev: OrdersSearch) => ({ ...prev, tab }), replace: true });

  const [table, setTable] = useState<RestaurantTable | null>(null);
  const live = table ? (tables.find((t) => t.id === table.id) ?? table) : null;

  if (live) return <OrderScreen mode="dine-in" table={live} onBack={() => setTable(null)} />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">Orders</h2>
          <p className="text-xs text-muted-foreground">Pick a table to start · view every bill</p>
        </div>
        <ReserveDialog />
      </div>

      {/* On mobile each tab is `flex-1` — two equal-width segments that
          fill the row (proper thumb-sized targets, no dead space on the
          right). On tablet+ they shrink back to auto-width chips so the
          bar doesn't stretch across a wide viewport. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: "take" as Tab, label: "Take order" },
            { id: "bills" as Tab, label: "Bills" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-medium transition-colors sm:flex-none sm:shrink-0 ${
              search.tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {search.tab === "take" ? (
        <TableGrid onOpen={setTable} showControls={showControls} />
      ) : (
        <BillsTable onOpen={(t) => setTable(t)} />
      )}
    </div>
  );
}

// Deprecated: use formatDateWithStoredBs(o.placedAt, o.placedAtBs) inline for
// order rows so the receipt shows the stamped BS date, not a recomputed one.

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

function BillsTable({ onOpen }: { onOpen: (t: RestaurantTable) => void }) {
  const { tables, settings, branchId, customers } = usePos();
  const search = useSearch({ from: ORDERS_ROUTE });
  const navigate = useNavigate();

  // Local mirror of the search input so typing feels instant. The URL is
  // updated only after the debounce settles.
  const [qInput, setQInput] = useState(search.q);
  useEffect(() => {
    // If the URL changes externally (browser back/forward, external link)
    // pull it back into the input.
    setQInput(search.q);
  }, [search.q]);
  const debouncedQ = useDebouncedValue(qInput, 300);

  const [print, setPrint] = useState<Order | null>(null);
  const [printReprint, setPrintReprint] = useState(false);

  // IRD: reprinting an already-paid bill must be watermarked as a copy —
  // ask the server (authoritative print_count) before showing it.
  const openPrint = async (o: OrderDto, mapped: Order) => {
    if (branchId) {
      const res = await ordersApi.registerPrint(branchId, o.id);
      setPrintReprint(res.data?.is_reprint ?? false);
    }
    setPrint(mapped);
  };

  // Helper: patch specific URL search params. `replace: true` avoids flooding
  // browser history with every filter tweak. Resets page to 1 by default so a
  // filter change doesn't leave the user on a page that no longer exists.
  const patchSearch = (patch: Partial<OrdersSearch>, resetPage = true) => {
    navigate({
      search: (prev: OrdersSearch) => {
        const next: OrdersSearch = { ...prev, ...patch };
        if (resetPage) next.page = 1;
        return next;
      },
      replace: true,
    });
  };

  // Sync debounced search text into the URL. Skips the effect on first mount
  // (when debouncedQ === search.q from initial state).
  useEffect(() => {
    if (debouncedQ !== search.q) {
      patchSearch({ q: debouncedQ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  // Default the bills tab to today's BS date range on first entry. Only
  // patches when both dates are empty — a bookmark with an explicit range
  // still opens exactly as saved.
  useEffect(() => {
    if (search.tab === "bills" && !search.bs_from && !search.bs_to) {
      const today = toBsIso(new Date());
      if (today) patchSearch({ bs_from: today, bs_to: today });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.tab]);

  // "dues" tab = closed bills paid via khata. Translate the virtual filter
  // into concrete status + payment_method for the API.
  const effectiveStatus =
    search.status === "all" || search.status === "dues" ? undefined : search.status;
  const effectivePaymentMethod = search.status === "dues" ? ("khata" as const) : undefined;
  const effectiveStatusForDues =
    search.status === "dues" ? ("paid" as const) : effectiveStatus;

  const { orders, meta, isLoading } = useOrdersList(branchId || null, {
    q: search.q.trim() || undefined,
    status: effectiveStatusForDues,
    payment_method: effectivePaymentMethod,
    bs_from: search.bs_from || undefined,
    bs_to: search.bs_to || undefined,
    page: search.page,
    per_page: search.per_page,
  });

  // Dine-in with a customer attached shows "T1 · Sabin" so the customer's
  // name surfaces on the bills list — previously the row read just "T1"
  // and the attach-customer action looked like it did nothing.
  const label = (o: OrderDto) => {
    if (o.type === "delivery") return o.customer?.name ?? "Delivery";
    const table = tables.find((t) => t.id === o.table_id)?.label ?? "Walk-in";
    return o.customer?.name ? `${table} · ${o.customer.name}` : table;
  };

  // Convert a DTO order → the client-side `Order` shape that BillReceipt +
  // billTotals expect. Only the fields those consumers actually read.
  const toOrder = (o: OrderDto): Order => ({
    id: o.id,
    billNumber: o.bill_number,
    tableId: o.table_id ?? "",
    type: o.type,
    ...(o.customer
      ? {
          customerId: o.customer.id,
          customer: {
            id: o.customer.id,
            name: o.customer.name,
            phone: o.customer.phone ?? "",
            address: o.customer.address ?? "",
          },
        }
      : {}),
    ...(o.delivery_status ? { deliveryStatus: o.delivery_status } : {}),
    lines: o.lines
      .filter((l) => !l.is_voided)
      .map((l) => ({
        id: l.id,
        menuItemId: l.menu_item_id ?? "",
        name: l.name,
        ...(l.variant_name ? { variantName: l.variant_name } : {}),
        price: Number(l.price),
        qty: l.qty,
        note: l.note ?? "",
        sent: l.sent,
      })),
    status: o.status === "draft" ? "draft" : "paid",
    kitchenStatus: o.kitchen_status,
    placedAt: parseApiDate(o.placed_at)?.getTime() ?? 0,
    placedAtBs: o.placed_at_bs,
    ...(o.paid_at_bs ? { paidAtBs: o.paid_at_bs } : {}),
    discountType: o.discount_type,
    discountValue: Number(o.discount_value),
    ...(o.payment_method ? { paymentMethod: o.payment_method } : {}),
    waiter: o.waiter_name,
    ...(o.kind ? { kind: o.kind } : {}),
    ...(o.buyer_pan ? { buyerPan: o.buyer_pan } : {}),
  });

  const clearFilters = () => {
    setQInput("");
    patchSearch({ q: "", status: "all", bs_from: "", bs_to: "" });
  };
  const anyFilterActive = Boolean(
    search.q.trim() || search.status !== "all" || search.bs_from || search.bs_to,
  );

  const totalPages = meta?.total_pages ?? 1;
  const total = meta?.total ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-9"
            placeholder="Bill #, waiter, table, customer name or phone"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "draft", "paid", "dues"] as const).map((f) => (
            <button
              key={f}
              onClick={() => patchSearch({ status: f })}
              className={`min-h-12 flex-1 rounded-xl px-4 text-sm capitalize transition-colors ${
                search.status === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {f === "draft"
                ? "Active"
                : f === "paid"
                  ? "Closed"
                  : f === "dues"
                    ? "Dues"
                    : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Native BS calendar pickers — no Gregorian conversion, values are
          BS ISO strings ("YYYY-MM-DD") that go straight to the URL / API. */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">From</p>
          <BsDatePicker
            value={search.bs_from}
            onChange={(v) => patchSearch({ bs_from: v })}
            placeholder="Any date"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">To</p>
          <BsDatePicker
            value={search.bs_to}
            onChange={(v) => patchSearch({ bs_to: v })}
            placeholder="Any date"
          />
        </div>
        {anyFilterActive && (
          <div className="flex items-end">
            <Button variant="outline" className="h-11 gap-1.5" onClick={clearFilters}>
              <X className="size-4" />
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="pos-card overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-3 pr-3">Bill no.</th>
              <th className="py-3 pr-3">Table / Customer</th>
              <th className="py-3 pr-3">Date</th>
              <th className="py-3 pr-3">Status</th>
              <th className="py-3 pr-3">Paid via</th>
              <th className="py-3 pr-3">Total</th>
              <th className="py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const table = tables.find((t) => t.id === o.table_id);
              const mapped = toOrder(o);
              return (
                <tr key={o.id} className="border-b border-border/70">
                  <td className="py-3 pr-3">#{o.bill_number}</td>
                  <td className="py-3 pr-3">{label(o)}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {formatDateWithStoredBs(parseApiDate(o.placed_at) ?? 0, o.placed_at_bs)}
                  </td>
                  <td className="py-3 pr-3">
                    {(() => {
                      const isKhata =
                        o.status === "paid" && o.payment_method === "khata";
                      // Khata order flips to "Settled" once the customer's
                      // overall balance is zero (paid off via the ledger).
                      // We do it at the customer level because settlements
                      // aren't attributed to individual orders.
                      const customerCleared =
                        isKhata &&
                        o.customer_id &&
                        (customers.find((c) => c.id === o.customer_id)?.outstandingBalance ?? 0) === 0;
                      const label =
                        o.status === "draft"
                          ? "Active"
                          : o.status === "paid"
                            ? isKhata
                              ? customerCleared
                                ? "Settled"
                                : "Khata"
                              : "Settled"
                            : "Cancelled";
                      const cls =
                        isKhata && !customerCleared
                          ? "bg-warning text-navy"
                          : o.status !== "draft"
                            ? "bg-success/15 text-success"
                            : "bg-primary/15 text-primary";
                      return (
                        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${cls}`}>
                          {label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 pr-3">
                    {o.payment_method ? (
                      <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {o.payment_method}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 font-semibold">
                    {NPR(billTotals(mapped, settings.vatEnabled, settings.vatRate).total)}
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      {o.status === "draft" && table && (
                        <Button variant="outline" className="h-10" onClick={() => onOpen(table)}>
                          Open
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10"
                        aria-label={`Print bill ${o.id}`}
                        onClick={() => void openPrint(o, mapped)}
                      >
                        <Printer className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  {isLoading ? "Loading…" : anyFilterActive ? "No bills match your filters." : "No bills yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
        <span>
          {total === 0
            ? "0 results"
            : `${(search.page - 1) * search.per_page + 1}–${Math.min(search.page * search.per_page, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={search.per_page}
              onChange={(e) => patchSearch({ per_page: Number(e.target.value) })}
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Previous page"
              disabled={search.page <= 1 || isLoading}
              onClick={() =>
                patchSearch({ page: Math.max(1, search.page - 1) }, false)
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[80px] text-center text-foreground">
              Page {search.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Next page"
              disabled={search.page >= totalPages || isLoading}
              onClick={() =>
                patchSearch({ page: Math.min(totalPages, search.page + 1) }, false)
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {print && (
        <PrintDialog open onOpenChange={(o) => !o && setPrint(null)} title="Print Bill">
          <BillReceipt
            order={print}
            tableLabel={print.type === "delivery" ? (print.customer?.name ?? "Delivery") : (tables.find((t) => t.id === print.tableId)?.label ?? "Walk-in")}
            settings={settings}
            totals={billTotals(print, settings.vatEnabled, settings.vatRate)}
            isReprint={printReprint}
          />
        </PrintDialog>
      )}
    </div>
  );
}
