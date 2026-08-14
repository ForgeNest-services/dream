import { PaginationBar, usePagination } from "@/components/common/pagination";
import { EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { CustomerDialog, LedgerDialog, PaymentDialog } from "@/components/parties/party-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-store";
import type { Party } from "@/data/types";
import { downloadCsv } from "@/lib/csv";
import { computeTotals } from "@/lib/invoice";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, Plus, Search, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_app/parties/customers")({
  head: () => ({
    meta: [
      { title: "Customers — SROTA IMS" },
      {
        name: "description",
        content:
          "Customer directory with PAN/VAT details, credit limits, purchase history, outstanding balance and ledger payments.",
      },
      { property: "og:title", content: "Customers — SROTA IMS" },
      {
        property: "og:description",
        content: "Customer accounts, purchase history and receivable ledgers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<Party | undefined>(undefined);
  const [payFor, setPayFor] = useState<Party | undefined>(undefined);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return app.parties
      .filter((p) => p.kind === "customer")
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.phone.includes(term) ||
          (p.pan ?? "").includes(term),
      )
      .map((p) => {
        const invoices = app.invoices.filter(
          (i) => i.customerId === p.id && i.kind !== "quotation",
        );
        const purchased = invoices.reduce(
          (s, i) => s + computeTotals(i.lines, app.company).total,
          0,
        );
        return { party: p, orders: invoices.length, purchased, balance: app.partyBalance(p.id) };
      });
  }, [app, q]);

  const pag = usePagination(rows, 12);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Buyer accounts, purchase history and outstanding receivables."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "customers",
                  rows.map((r) => ({
                    name: r.party.name,
                    phone: r.party.phone,
                    pan: r.party.pan ?? "",
                    orders: r.orders,
                    purchased: r.purchased.toFixed(2),
                    balance: r.balance.toFixed(2),
                  })),
                )
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New customer
            </Button>
          </>
        }
      />

      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone or PAN"
          className="pl-9"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No customers" description="Add your first customer to start billing." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                <th className="px-3 py-2.5 text-left font-medium">Contact</th>
                <th className="px-3 py-2.5 text-left font-medium">PAN / VAT</th>
                <th className="px-3 py-2.5 text-right font-medium">Orders</th>
                <th className="px-3 py-2.5 text-right font-medium">Purchased</th>
                <th className="px-3 py-2.5 text-right font-medium">Receivable</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pag.slice.map((r) => (
                <tr key={r.party.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{r.party.name}</p>
                    <p className="text-xs text-muted-foreground">{r.party.address}</p>
                  </td>
                  <td className="num px-3 py-2.5">{r.party.phone}</td>
                  <td className="num px-3 py-2.5">{r.party.pan ?? "—"}</td>
                  <td className="num px-3 py-2.5 text-right">{r.orders}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={r.purchased} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={r.balance} className={r.balance > 0 ? "text-warning" : ""} />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setLedgerFor(r.party)}>
                        <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Ledger
                      </Button>
                      {app.can("payment.record") && (
                        <Button variant="outline" size="sm" onClick={() => setPayFor(r.party)}>
                          <Wallet className="mr-1.5 h-3.5 w-3.5" /> Payment
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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

      <CustomerDialog open={addOpen} onOpenChange={setAddOpen} kind="customer" />
      <LedgerDialog
        open={Boolean(ledgerFor)}
        onOpenChange={(o) => !o && setLedgerFor(undefined)}
        party={ledgerFor}
      />
      <PaymentDialog
        open={Boolean(payFor)}
        onOpenChange={(o) => !o && setPayFor(undefined)}
        party={payFor}
      />
    </div>
  );
}
