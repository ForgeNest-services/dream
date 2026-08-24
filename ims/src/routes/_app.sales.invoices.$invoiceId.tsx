import { EmptyState, Money, PageHeader, StatusPill, DateText } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-store";
import { computeStoredTotals, invoiceDue } from "@/lib/invoice";
import { invoicesApi, type InvoiceDto } from "@/lib/invoices-api";
import type { Invoice, InvoiceLine } from "@/data/types";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sales/invoices/$invoiceId")({
  head: () => ({
    meta: [{ title: "Invoice — SROTA IMS" }],
  }),
  component: InvoiceDetailPage,
});

// Backend Decimal fields serialize as JSON strings — coerce before arithmetic.
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
    paymentMethod: i.payment_method as Invoice["paymentMethod"],
    paidAmount: Number(i.paid_amount),
    status: i.status,
    userId: i.user_id,
    note: i.note ?? undefined,
  };
}

function InvoiceDetailPage() {
  const { invoiceId } = useParams({ from: "/_app/sales/invoices/$invoiceId" });
  const app = useApp();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    invoicesApi
      .get(invoiceId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success || !res.data) {
          setNotFound(true);
          return;
        }
        setInvoice(dtoToInvoice(res.data));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to load invoice");
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const backButton = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/sales/invoices">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to invoices
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Loading…" actions={backButton} />
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Invoice not found" actions={backButton} />
        <EmptyState
          title="This document doesn't exist"
          description="It may have been deleted, or the link is wrong — go back and open it from the list."
        />
      </div>
    );
  }

  const customer = app.parties.find((p) => p.id === invoice.customerId);
  const branch = app.branches.find((b) => b.id === invoice.branchId);
  const totals = computeStoredTotals(invoice.lines);
  const due = invoiceDue(invoice, totals.total);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={invoice.number}
        subtitle={`${invoice.kind === "quotation" ? "Quotation" : invoice.kind === "tax" ? "Tax invoice" : "Abbreviated invoice"} · ${branch?.name ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            {backButton}
            <Button asChild variant="outline" size="sm">
              <Link to="/print/$invoiceId" params={{ invoiceId: invoice.id }}>
                <Printer className="mr-1.5 h-4 w-4" /> Print
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer
          </h2>
          <p className="mt-1.5 text-sm font-medium">{customer?.name ?? "—"}</p>
          {customer?.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
          {customer?.address && <p className="text-xs text-muted-foreground">{customer.address}</p>}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Details
          </h2>
          <dl className="mt-1.5 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Date</dt>
              <dd>
                <DateText value={invoice.date} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment method</dt>
              <dd className="capitalize">{invoice.paymentMethod}</dd>
            </div>
            {invoice.kind !== "quotation" && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusPill status={invoice.status} />
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Item</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty</th>
              <th className="px-3 py-2.5 text-right font-medium">Rate</th>
              <th className="px-3 py-2.5 text-right font-medium">Discount</th>
              <th className="px-3 py-2.5 text-right font-medium">VAT</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => {
              const product = app.products.find((p) => p.id === line.productId);
              const variant = app.variants.find((v) => v.id === line.variantId);
              const unit = app.units.find((u) => u.id === line.unitId);
              const gross = (line.rate - line.discount) * line.qty;
              return (
                <tr key={line.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{line.description || product?.name || "—"}</p>
                    {variant && variant.name !== "Default" && (
                      <p className="text-xs text-muted-foreground">{variant.name}</p>
                    )}
                  </td>
                  <td className="num px-3 py-2.5 text-right">
                    {line.qty}
                    {unit ? ` ${unit.symbol}` : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={line.rate} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={line.discount} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {line.taxable === false ? (
                      <span className="text-xs text-muted-foreground">Exempt</span>
                    ) : (
                      <Money value={line.vatAmount ?? 0} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Money value={gross + (line.vatAmount ?? 0)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t p-4">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable</span>
              <Money value={totals.taxable} />
            </div>
            {totals.exempt > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exempt</span>
                <Money value={totals.exempt} />
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT</span>
              <Money value={totals.vat} />
            </div>
            <div className="flex justify-between border-t pt-1.5 font-medium">
              <span>Total</span>
              <Money value={totals.total} />
            </div>
            {invoice.kind !== "quotation" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <Money value={invoice.paidAmount} />
                </div>
                <div className="flex justify-between font-medium text-destructive">
                  <span>Due</span>
                  <Money value={due} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {invoice.note && (
        <div className="mt-4 rounded-lg border bg-card p-4 text-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Note</h2>
          <p className="mt-1">{invoice.note}</p>
        </div>
      )}
    </div>
  );
}
