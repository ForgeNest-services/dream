import { DateRangeFilter } from "@/components/common/date-picker";
import { PaginationBar, usePagination } from "@/components/common/pagination";
import { DateText, EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import { downloadCsv } from "@/lib/csv";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

export const Route = createFileRoute("/_app/purchase/bills")({
  head: () => ({
    meta: [
      { title: "Purchase Bills — SROTA IMS" },
      {
        name: "description",
        content:
          "Register of supplier purchase bills with items received, bill amount, payments made and outstanding balance per party.",
      },
      { property: "og:title", content: "Purchase Bills — SROTA IMS" },
      {
        property: "og:description",
        content: "Supplier purchase register with items, payments and ledger status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PurchaseBillsPage,
});

function PurchaseBillsPage() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [partyId, setPartyId] = useState("all");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return app.purchases.filter((pu) => {
      if (app.branchId !== "all" && pu.branchId !== app.branchId) return false;
      if (partyId !== "all" && pu.partyId !== partyId) return false;
      if (from && pu.date < from) return false;
      if (to && pu.date > to) return false;
      if (
        term &&
        !`${pu.number} ${pu.billNo ?? ""}`.toLowerCase().includes(term) &&
        !pu.lines.some((l) => l.description.toLowerCase().includes(term))
      )
        return false;
      return true;
    });
  }, [app.purchases, app.branchId, partyId, from, to, q]);

  const { page, setPage, pageCount, slice, total, pageSize } = usePagination(rows, 10);

  const exportCsv = () =>
    downloadCsv(
      "purchase-bills",
      rows.map((pu) => ({
        number: pu.number,
        billNo: pu.billNo ?? "",
        date: pu.date,
        party: app.parties.find((p) => p.id === pu.partyId)?.name ?? "—",
        items: pu.lines.length,
        itemsTotal: pu.itemsTotal,
        billAmount: pu.billAmount,
        paid: pu.paidAmount,
      })),
    );

  return (
    <div>
      <PageHeader
        title="Purchase Bills"
        subtitle={`${app.purchases.length} recorded purchase entries`}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search bill no. or item…"
            className="pl-8"
          />
        </div>
        <Select value={partyId} onValueChange={setPartyId}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All parties</SelectItem>
            {app.parties
              .filter((p) => p.kind === "supplier")
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No purchase bills yet"
          description="Record a supplier bill from the New Purchase tab — stock and ledger post together."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th className="px-3 py-2.5 text-left font-medium">Entry</th>
                  <th className="px-3 py-2.5 text-left font-medium">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">Party</th>
                  <th className="px-3 py-2.5 text-right font-medium">Items</th>
                  <th className="px-3 py-2.5 text-right font-medium">Bill amount</th>
                  <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                  <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((pu) => {
                  const expanded = open[pu.id] ?? false;
                  return (
                    <Fragment key={pu.id}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="pl-2">
                          <button
                            type="button"
                            aria-label={expanded ? "Collapse items" : "Expand items"}
                            onClick={() => setOpen((o) => ({ ...o, [pu.id]: !expanded }))}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="num font-medium">{pu.number}</p>
                          <p className="num text-xs text-muted-foreground">
                            {pu.billNo ? `Bill ${pu.billNo}` : "No bill no."}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <DateText value={pu.date} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {app.parties.find((p) => p.id === pu.partyId)?.name ?? "—"}
                          {pu.partyId && !pu.postToLedger ? " (not tracked)" : ""}
                        </td>
                        <td className="num px-3 py-2.5 text-right">{pu.lines.length}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={pu.billAmount || pu.itemsTotal} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={pu.paidAmount} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money value={Math.max(0, (pu.billAmount || pu.itemsTotal) - pu.paidAmount)} />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t bg-muted/20">
                          <td />
                          <td colSpan={7} className="px-3 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="py-1 text-left font-medium">Item</th>
                                  <th className="py-1 text-right font-medium">Qty</th>
                                  <th className="py-1 text-right font-medium">Unit cost</th>
                                  <th className="py-1 text-right font-medium">Amount</th>
                                  <th className="py-1 text-right font-medium">VAT</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pu.lines.map((l) => (
                                  <tr key={l.id} className="border-t border-border/60">
                                    <td className="py-1.5">
                                      {l.description}
                                      {!l.taxable && (
                                        <span className="ml-1.5 text-muted-foreground">
                                          (non-taxable)
                                        </span>
                                      )}
                                    </td>
                                    <td className="num py-1.5 text-right">
                                      {l.qty} {app.unitSymbol(l.unitId)}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Money value={l.unitCost} />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Money value={l.qty * l.unitCost} />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {l.taxable ? <Money value={l.vatAmount} /> : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t font-medium">
                                  <td className="py-1.5" colSpan={3}>
                                    VAT total
                                  </td>
                                  <td />
                                  <td className="py-1.5 text-right">
                                    <Money value={pu.lines.reduce((s, l) => s + l.vatAmount, 0)} />
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            {pu.note ? (
                              <p className="mt-2 text-xs text-muted-foreground">{pu.note}</p>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
