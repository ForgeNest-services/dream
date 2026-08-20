import { TablePagination } from "@/components/common/table-pagination";
import { EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { CustomerDialog, LedgerDialog, PaymentDialog } from "@/components/parties/party-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { useParties } from "@/hooks/useParties";
import type { Party } from "@/data/types";
import { downloadCsv } from "@/lib/csv";
import { computeTotals } from "@/lib/invoice";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, Plus, Search, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

interface CustomersSearch {
  q: string;
  page: number;
  perPage: number;
}

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
  validateSearch: (search: Record<string, unknown>): CustomersSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: CustomersPage,
});

function dtoToParty(p: {
  id: string;
  name: string;
  kind: "supplier" | "customer";
  phone: string | null;
  email: string | null;
  address: string | null;
  pan: string | null;
  is_vat_registered: boolean | null;
  credit_limit: number | null;
  opening_balance: number;
  terms: string | null;
}): Party {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    phone: p.phone ?? "",
    email: p.email ?? undefined,
    address: p.address ?? "",
    pan: p.pan ?? undefined,
    isVatRegistered: p.is_vat_registered ?? undefined,
    creditLimit: p.credit_limit ?? undefined,
    openingBalance: p.opening_balance,
    terms: p.terms ?? undefined,
  };
}

function CustomersPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<CustomersSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const [addOpen, setAddOpen] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<Party | undefined>(undefined);
  const [payFor, setPayFor] = useState<Party | undefined>(undefined);

  const debouncedQ = useDebouncedValue(search.q, 300);

  const { parties, meta, isLoading, refetch } = useParties({
    kind: "customer",
    q: debouncedQ || undefined,
    page: search.page,
    per_page: search.perPage,
  });

  useEffect(() => {
    if (meta && search.page > meta.total_pages) {
      setSearch({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.total_pages]);

  const rows = parties.map((dto) => {
    const party = dtoToParty(dto);
    const invoices = app.invoices.filter((i) => i.customerId === party.id && i.kind !== "quotation");
    const purchased = invoices.reduce((s, i) => s + computeTotals(i.lines, app.company).total, 0);
    return { party, orders: invoices.length, purchased, balance: app.partyBalance(party.id) };
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${meta?.total ?? rows.length} buyer accounts, purchase history and outstanding receivables.`}
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
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
          placeholder="Search name, phone or PAN"
          className="pl-9"
        />
      </div>

      {!isLoading && rows.length === 0 ? (
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
              {rows.map((r) => (
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
          <TablePagination
            page={meta?.page ?? search.page}
            perPage={meta?.per_page ?? search.perPage}
            totalItems={meta?.total ?? rows.length}
            totalPages={meta?.total_pages ?? 1}
            onPageChange={(p) => setSearch({ page: p })}
            onPerPageChange={(pp) => setSearch({ perPage: pp, page: 1 })}
          />
        </div>
      )}

      <CustomerDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) refetch();
        }}
        kind="customer"
      />
      <LedgerDialog
        open={Boolean(ledgerFor)}
        onOpenChange={(o) => !o && setLedgerFor(undefined)}
        party={ledgerFor}
      />
      <PaymentDialog
        open={Boolean(payFor)}
        onOpenChange={(o) => {
          if (!o) {
            setPayFor(undefined);
            refetch();
          }
        }}
        party={payFor}
      />
    </div>
  );
}
