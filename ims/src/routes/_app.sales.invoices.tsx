import { DateRangeFilter } from "@/components/common/date-picker";
import { PaginationBar, usePagination } from "@/components/common/pagination";
import { DateText, EmptyState, Money, PageHeader, StatusPill } from "@/components/common/primitives";
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
import { computeTotals } from "@/lib/invoice";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Printer, Search } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_app/sales/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — SROTA IMS" },
      {
        name: "description",
        content:
          "All tax and abbreviated invoices with VAT breakdown, payment status, branch and Bikram Sambat date filters.",
      },
      { property: "og:title", content: "Invoices — SROTA IMS" },
      {
        property: "og:description",
        content: "IRD-compliant invoice register with VAT breakdown and payment status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return app.invoices
      .filter((i) => i.kind !== "quotation")
      .filter((i) => (app.branchId === "all" ? true : i.branchId === app.branchId))
      .filter((i) => (status === "all" ? true : i.status === status))
      .filter((i) => (from ? i.date >= from : true))
      .filter((i) => (to ? i.date <= to : true))
      .filter((i) => {
        if (!term) return true;
        const cust = app.parties.find((p) => p.id === i.customerId);
        return (
          i.number.toLowerCase().includes(term) ||
          (cust?.name.toLowerCase().includes(term) ?? false)
        );
      });
  }, [app.invoices, app.parties, app.branchId, q, status, from, to]);

  const pag = usePagination(rows, 12);

  const exportCsv = () =>
    downloadCsv(
      "invoices",
      rows.map((i) => {
        const t = computeTotals(i.lines, app.company);
        return {
          number: i.number,
          date: i.date.slice(0, 10),
          customer: app.parties.find((p) => p.id === i.customerId)?.name ?? "",
          taxable: t.taxable.toFixed(2),
          vat: t.vat.toFixed(2),
          total: t.total.toFixed(2),
          paid: i.paidAmount.toFixed(2),
          status: i.status,
        };
      }),
    );

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${rows.length} document${rows.length === 1 ? "" : "s"} in the current branch and date range`}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice no. or customer"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No invoices found" description="Adjust the filters or make a sale." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Invoice</th>
                <th className="px-3 py-2.5 text-left font-medium">Date</th>
                <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                <th className="px-3 py-2.5 text-right font-medium">Taxable</th>
                <th className="px-3 py-2.5 text-right font-medium">VAT</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 text-right font-medium">Due</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pag.slice.map((i) => {
                const t = computeTotals(i.lines, app.company);
                const cust = app.parties.find((p) => p.id === i.customerId);
                return (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="num px-3 py-2.5">
                      {i.number}
                      <span className="ml-1.5 text-xs capitalize text-muted-foreground">
                        {i.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <DateText value={i.date} />
                    </td>
                    <td className="px-3 py-2.5">{cust?.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={t.taxable} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={t.vat} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={t.total} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={Math.max(0, t.total - i.paidAmount)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={i.status} />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/print/$invoiceId" params={{ invoiceId: i.id }}>
                          <Printer className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationBar
            page={pag.page}
            pageCount={pag.pageCount}
            total={pag.total}
            pageSize={pag.pageSize}
            onChange={pag.setPage}
          />
        </div>
      )}
    </div>
  );
}
