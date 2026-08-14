import { PaginationBar, usePagination } from "@/components/common/pagination";
import { DateText, EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-store";
import { computeTotals } from "@/lib/invoice";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightLeft, Printer, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sales/quotations")({
  head: () => ({
    meta: [
      { title: "Quotations — SROTA IMS" },
      {
        name: "description",
        content:
          "Build and track customer quotations, then convert an accepted quotation into a tax invoice in one click.",
      },
      { property: "og:title", content: "Quotations — SROTA IMS" },
      {
        property: "og:description",
        content: "Customer quotations with one-click conversion to invoice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuotationsPage,
});

function QuotationsPage() {
  const app = useApp();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return app.invoices
      .filter((i) => i.kind === "quotation")
      .filter((i) => (app.branchId === "all" ? true : i.branchId === app.branchId))
      .filter((i) => {
        if (!term) return true;
        const c = app.parties.find((p) => p.id === i.customerId);
        return (
          i.number.toLowerCase().includes(term) || (c?.name.toLowerCase().includes(term) ?? false)
        );
      });
  }, [app.invoices, app.parties, app.branchId, q]);

  const pag = usePagination(rows, 12);

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Price offers sent to customers. Convert to an invoice when accepted."
        actions={
          <Button asChild size="sm">
            <Link to="/sales/pos">New quotation from POS</Link>
          </Button>
        }
      />

      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search quotation no. or customer"
          className="pl-9"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No quotations yet" description="Create one from the POS screen." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Quotation</th>
                <th className="px-3 py-2.5 text-left font-medium">Date</th>
                <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                <th className="px-3 py-2.5 text-right font-medium">Items</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pag.slice.map((i) => {
                const t = computeTotals(i.lines, app.company);
                return (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="num px-3 py-2.5">{i.number}</td>
                    <td className="px-3 py-2.5">
                      <DateText value={i.date} />
                    </td>
                    <td className="px-3 py-2.5">
                      {app.parties.find((p) => p.id === i.customerId)?.name ?? "—"}
                    </td>
                    <td className="num px-3 py-2.5 text-right">{i.lines.length}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={t.total} />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            app.convertQuotation(i.id);
                            toast.success(`${i.number} converted to invoice`);
                          }}
                        >
                          <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Convert
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/print/$invoiceId" params={{ invoiceId: i.id }}>
                            <Printer className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
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
