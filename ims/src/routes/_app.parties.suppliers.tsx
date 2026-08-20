import { TablePagination } from "@/components/common/table-pagination";
import { EmptyState, Money, PageHeader } from "@/components/common/primitives";
import { CustomerDialog, LedgerDialog, PaymentDialog } from "@/components/parties/party-dialogs";
import { RestockDialog } from "@/components/inventory/stock-dialogs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { useParties } from "@/hooks/useParties";
import type { Party } from "@/data/types";
import { downloadCsv } from "@/lib/csv";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, Pencil, PackagePlus, Plus, Search, Trash2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SuppliersSearch {
  q: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/parties/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — SROTA IMS" },
      {
        name: "description",
        content:
          "Supplier directory with PAN/VAT, payment terms, purchase totals, payable balances and party ledgers.",
      },
      { property: "og:title", content: "Suppliers — SROTA IMS" },
      {
        property: "og:description",
        content: "Supplier accounts, purchases and payable ledgers with payment recording.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): SuppliersSearch => {
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
  component: SuppliersPage,
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
  credit_limit: number | string | null;
  opening_balance: number | string;
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
    // Backend Decimal fields serialize as JSON strings — coerce or
    // arithmetic on these silently does string concatenation.
    creditLimit: p.credit_limit == null ? undefined : Number(p.credit_limit),
    openingBalance: Number(p.opening_balance),
    terms: p.terms ?? undefined,
  };
}

function SuppliersPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<SuppliersSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const [addOpen, setAddOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<Party | undefined>(undefined);
  const [payFor, setPayFor] = useState<Party | undefined>(undefined);
  const [editFor, setEditFor] = useState<Party | undefined>(undefined);
  const [deleteFor, setDeleteFor] = useState<Party | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Backend only allows owner/manager to delete a party — matches the
  // same restriction used for products.
  const canDelete = app.effectiveRole === "owner" || app.effectiveRole === "manager";

  const debouncedQ = useDebouncedValue(search.q, 300);

  const { parties, meta, isLoading, refetch } = useParties({
    kind: "supplier",
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
    const purchases = app.movements.filter((m) => m.supplierId === party.id);
    const purchased = purchases.reduce((s, m) => s + (m.unitCost ?? 0) * m.qty, 0);
    return { party, deliveries: purchases.length, purchased, balance: app.partyBalance(party.id) };
  });

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${meta?.total ?? rows.length} vendor accounts, goods received and outstanding payables.`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "suppliers",
                  rows.map((r) => ({
                    name: r.party.name,
                    phone: r.party.phone,
                    pan: r.party.pan ?? "",
                    terms: r.party.terms ?? "",
                    deliveries: r.deliveries,
                    purchased: r.purchased.toFixed(2),
                    payable: r.balance.toFixed(2),
                  })),
                )
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            {app.can("stock.restock") && (
              <Button variant="outline" size="sm" onClick={() => setRestockOpen(true)}>
                <PackagePlus className="mr-1.5 h-4 w-4" /> Restock
              </Button>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New supplier
            </Button>
          </>
        }
      />

      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="suppliers-search"
          autoComplete="new-suppliers-search"
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
          placeholder="Search name, phone or PAN"
          className="pl-9"
        />
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState title="No suppliers" description="Add a supplier to track purchases." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">Supplier</th>
                <th className="px-3 py-2.5 text-left font-medium">Contact</th>
                <th className="px-3 py-2.5 text-left font-medium">PAN / VAT</th>
                <th className="px-3 py-2.5 text-left font-medium">Terms</th>
                <th className="px-3 py-2.5 text-right font-medium">Deliveries</th>
                <th className="px-3 py-2.5 text-right font-medium">Purchased</th>
                <th className="px-3 py-2.5 text-right font-medium">Payable</th>
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
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.party.terms ?? "—"}
                  </td>
                  <td className="num px-3 py-2.5 text-right">{r.deliveries}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={r.purchased} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={r.balance} className={r.balance > 0 ? "text-destructive" : ""} />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setLedgerFor(r.party)}>
                        <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Ledger
                      </Button>
                      {app.can("payment.record") && (
                        <Button variant="outline" size="sm" onClick={() => setPayFor(r.party)}>
                          <Wallet className="mr-1.5 h-3.5 w-3.5" /> Pay
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setEditFor(r.party)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteFor(r.party)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
        kind="supplier"
      />
      <CustomerDialog
        open={Boolean(editFor)}
        onOpenChange={(o) => {
          if (!o) {
            setEditFor(undefined);
            refetch();
          }
        }}
        kind="supplier"
        party={editFor}
      />
      <RestockDialog open={restockOpen} onOpenChange={setRestockOpen} />
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

      <AlertDialog open={deleteFor !== null} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteFor?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the supplier and its full ledger history. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteFor) return;
                setDeleting(true);
                try {
                  const res = await app.deleteParty(deleteFor.id);
                  if (!res.ok) {
                    toast.error(res.error ?? "Failed to delete supplier");
                    return;
                  }
                  toast.success("Supplier deleted");
                  setDeleteFor(null);
                  refetch();
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
