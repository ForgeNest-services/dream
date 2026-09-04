import { TablePagination } from "@/components/common/table-pagination";
import { DateText, EmptyState, Money, PageHeader } from "@/components/common/primitives";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import { ApiError } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { useInvoices } from "@/hooks/useInvoices";
import { invoicesApi, type InvoiceDto } from "@/lib/invoices-api";
import type { Invoice, InvoiceLine, PaymentMethod } from "@/data/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightLeft, Eye, Printer, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface QuotationsSearch {
  q: string;
  page: number;
  perPage: number;
}

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
  validateSearch: (search: Record<string, unknown>): QuotationsSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 12,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: QuotationsPage,
});

function dtoToInvoice(i: InvoiceDto): Invoice {
  return {
    id: i.id,
    number: i.number,
    kind: i.kind,
    date: i.date,
    branchId: i.branch_id,
    customerId: i.customer_id,
    lines: i.lines.map(
      (l): InvoiceLine => ({
        id: l.id,
        productId: l.product_id,
        variantId: l.variant_id,
        description: l.description,
        qty: Number(l.qty),
        unitId: l.unit_id,
        rate: Number(l.rate),
        discount: Number(l.discount),
        taxable: l.taxable,
        taxRate: Number(l.tax_rate),
        vatAmount: Number(l.vat_amount),
      }),
    ),
    paymentMethod: i.payment_method as PaymentMethod,
    paidAmount: Number(i.paid_amount),
    status: i.status,
    userId: i.user_id,
    note: i.note ?? undefined,
  };
}

function QuotationsPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<QuotationsSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const debouncedQ = useDebouncedValue(search.q, 300);
  const [convertFor, setConvertFor] = useState<Invoice | null>(null);
  const [voidFor, setVoidFor] = useState<Invoice | null>(null);
  const [voiding, setVoiding] = useState(false);

  const { invoices: quoteDtos, meta, isLoading, refetch } = useInvoices({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    kind: "quotation",
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

  const rows = quoteDtos.map((dto) => ({
    inv: dtoToInvoice(dto),
    total: Number(dto.total_amount),
  }));

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Price offers sent to customers. Convert to an invoice when accepted."
        actions={
          <Button asChild size="sm">
            <Link to="/sales/pos" search={{ mode: "quotation" }}>
              New quotation from POS
            </Link>
          </Button>
        }
      />

      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
          placeholder="Search quotation no. or customer"
          className="pl-9"
        />
      </div>

      {!isLoading && rows.length === 0 ? (
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
              {rows.map((r) => (
                <tr key={r.inv.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="num px-3 py-2.5">{r.inv.number}</td>
                  <td className="px-3 py-2.5">
                    <DateText value={r.inv.date} />
                  </td>
                  <td className="px-3 py-2.5">
                    {app.parties.find((p) => p.id === r.inv.customerId)?.name ?? "—"}
                  </td>
                  <td className="num px-3 py-2.5 text-right">{r.inv.lines.length}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={r.total} />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => setConvertFor(r.inv)}>
                        <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Convert
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/sales/invoices/$invoiceId" params={{ invoiceId: r.inv.id }}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/print/$invoiceId" params={{ invoiceId: r.inv.id }}>
                          <Printer className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setVoidFor(r.inv)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

      <ConvertQuotationDialog
        invoice={convertFor}
        onOpenChange={(o) => !o && setConvertFor(null)}
        onConverted={() => {
          setConvertFor(null);
          refetch();
        }}
      />

      <AlertDialog open={!!voidFor} onOpenChange={(o) => !o && setVoidFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void {voidFor?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the quotation permanently — it was never an issued bill (no IRD
              number, no stock or ledger effect), so nothing needs reconciling. This can&apos;t
              be undone; you can always create a new quotation for the same customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={voiding}
              onClick={async (e) => {
                e.preventDefault();
                if (!voidFor) return;
                setVoiding(true);
                try {
                  await invoicesApi.voidQuotation(voidFor.id);
                  toast.success("Quotation voided");
                  setVoidFor(null);
                  refetch();
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Failed to void quotation");
                } finally {
                  setVoiding(false);
                }
              }}
            >
              {voiding ? "Voiding…" : "Void quotation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConvertQuotationDialog({
  invoice,
  onOpenChange,
  onConverted,
}: {
  invoice: Invoice | null;
  onOpenChange: (open: boolean) => void;
  onConverted: () => void;
}) {
  const app = useApp();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [converting, setConverting] = useState(false);

  const total = invoice
    ? invoice.lines.reduce((s, l) => s + (l.rate - l.discount) * l.qty, 0)
    : 0;

  useEffect(() => {
    if (invoice) setPaidAmount(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  if (!invoice) return null;

  const convert = async () => {
    setConverting(true);
    try {
      const res = await app.convertQuotation(invoice.id, {
        paymentMethod: method,
        paidAmount,
      });
      if (!res.ok || !res.invoice) {
        toast.error(res.error ?? "Failed to convert quotation");
        return;
      }
      toast.success(`${res.invoice.number} — stock deducted and ledger updated`);
      onConverted();
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Convert {invoice.number} to invoice</DialogTitle>
          <DialogDescription>
            This deducts stock and posts the sale to the customer's ledger.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <Money value={total} />
          </div>
          <div>
            <Label className="text-xs">Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="qr">QR</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="credit">Credit (unpaid)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Amount paid now</Label>
            <Input
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
              className="num mt-1 text-right"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={converting}>
            Cancel
          </Button>
          <Button onClick={() => void convert()} disabled={converting}>
            {converting ? "Converting…" : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
