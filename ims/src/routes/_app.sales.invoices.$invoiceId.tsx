import { EmptyState, Money, PageHeader, StatusPill, DateText } from "@/components/common/primitives";
import { DecimalTextInput } from "@/components/inventory/numeric-input";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/app-store";
import { computeStoredTotals, invoiceDue } from "@/lib/invoice";
import { invoicesApi, type InvoiceDto } from "@/lib/invoices-api";
import type { Invoice, InvoiceLine } from "@/data/types";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, FileX2, Printer, RefreshCw, Upload, Wallet } from "lucide-react";
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
        hsCode: l.hs_code,
      }),
    ),
    paymentMethod: i.payment_method as Invoice["paymentMethod"],
    paidAmount: Number(i.paid_amount),
    status: i.status,
    userId: i.user_id,
    enteredByName: i.entered_by_name,
    note: i.note ?? undefined,
    sellerName: i.seller_name,
    sellerAddress: i.seller_address,
    sellerPan: i.seller_pan,
    buyerName: i.buyer_name,
    buyerPan: i.buyer_pan,
    buyerAddress: i.buyer_address,
    isReprint: i.is_reprint,
    reprintOf: i.reprint_of,
    reprintNumber: i.reprint_number,
    printedByName: i.printed_by_name,
    isCreditNote: i.is_credit_note,
    originalInvoiceId: i.original_invoice_id,
    noteReason: i.note_reason,
    cbmsSynced: i.cbms_synced,
  };
}

function InvoiceDetailPage() {
  const { invoiceId } = useParams({ from: "/_app/sales/invoices/$invoiceId" });
  const app = useApp();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showCnDialog, setShowCnDialog] = useState(false);
  const [cnReason, setCnReason] = useState("");
  const [isIssuingCn, setIsIssuingCn] = useState(false);
  const [isSyncingCbms, setIsSyncingCbms] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr">("cash");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

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

  async function handleIssueCreditNote() {
    if (!cnReason.trim()) {
      toast.error("Please enter a reason for the credit note");
      return;
    }
    setIsIssuingCn(true);
    try {
      const res = await invoicesApi.creditNote(invoiceId, cnReason.trim());
      if (!res.success || !res.data) {
        toast.error((res as { message?: string }).message ?? "Failed to issue credit note");
        return;
      }
      toast.success(`Credit note ${res.data.number} issued`);
      setShowCnDialog(false);
      setCnReason("");
      // Reload this page's invoice to reflect the cancelled/credited state
      setInvoice(dtoToInvoice(res.data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue credit note");
    } finally {
      setIsIssuingCn(false);
    }
  }

  async function handleCbmsSync() {
    setIsSyncingCbms(true);
    try {
      const res = await invoicesApi.cbmsSync(invoiceId);
      if (!res.success || !res.data) {
        toast.error((res as { message?: string }).message ?? "Failed to sync to CBMS");
        return;
      }
      toast.success(res.data.message ?? "Invoice synced to IRD CBMS");
      if (invoice) {
        setInvoice({ ...invoice, cbmsSynced: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync to CBMS");
    } finally {
      setIsSyncingCbms(false);
    }
  }

  async function handleRecordPayment() {
    if (paymentAmount <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    setIsRecordingPayment(true);
    try {
      const res = await invoicesApi.recordPayment(invoiceId, paymentAmount, paymentMethod);
      if (!res.success || !res.data) {
        toast.error((res as { message?: string }).message ?? "Failed to record payment");
        return;
      }
      toast.success("Payment recorded");
      setShowPaymentDialog(false);
      setPaymentAmount(0);
      setInvoice(dtoToInvoice(res.data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setIsRecordingPayment(false);
    }
  }

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
  const canIssueCn =
    !invoice.isCreditNote &&
    invoice.kind !== "quotation" &&
    ["owner", "manager"].includes(app.effectiveRole ?? "");

  const canSyncCbms =
    app.company.isVatRegisteredTenant === true &&
    invoice.kind !== "quotation" &&
    !invoice.cbmsSynced &&
    ["owner", "manager"].includes(app.effectiveRole ?? "");

  const canRecordPayment =
    !invoice.isCreditNote && invoice.kind !== "quotation" && due > 0;

  return (
    <>
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={invoice.number}
        subtitle={`${invoice.kind === "quotation" ? "Quotation" : invoice.kind === "tax" ? "Tax invoice" : "Abbreviated invoice"} · ${branch?.name ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            {backButton}
            {invoice.isReprint && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                <RefreshCw className="h-3 w-3" /> Reprint #{invoice.reprintNumber}
              </span>
            )}
            {invoice.isCreditNote && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                <FileX2 className="h-3 w-3" /> Credit Note
              </span>
            )}
            {canIssueCn && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowCnDialog(true)}
              >
                <FileX2 className="mr-1.5 h-4 w-4" /> Credit Note
              </Button>
            )}
            {canSyncCbms && (
              <Button
                variant="outline"
                size="sm"
                disabled={isSyncingCbms}
                onClick={handleCbmsSync}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {isSyncingCbms ? "Syncing…" : "Sync to CBMS"}
              </Button>
            )}
            {canRecordPayment && (
              <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
                <Wallet className="mr-1.5 h-4 w-4" /> Record Payment
              </Button>
            )}
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
              {app.company.isVatRegisteredTenant && (
                <th className="px-3 py-2.5 text-right font-medium">VAT</th>
              )}
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
                  {app.company.isVatRegisteredTenant && (
                    <td className="px-3 py-2.5 text-right">
                      {line.taxable === false ? (
                        <span className="text-xs text-muted-foreground">Exempt</span>
                      ) : (
                        <Money value={line.vatAmount ?? 0} />
                      )}
                    </td>
                  )}
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
            {app.company.isVatRegisteredTenant && (
              <>
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
              </>
            )}
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

      {invoice.isCreditNote && invoice.noteReason && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-red-700">
            Credit Note Reason
          </h2>
          <p className="mt-1 text-red-900">{invoice.noteReason}</p>
        </div>
      )}

      {app.company.isVatRegisteredTenant === true && !invoice.cbmsSynced && invoice.kind !== "quotation" && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          This invoice has not yet been synced to the IRD CBMS system.
        </div>
      )}
    </div>

    <AlertDialog open={showCnDialog} onOpenChange={setShowCnDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Issue Credit Note</AlertDialogTitle>
          <AlertDialogDescription>
            A credit note will be issued for <strong>{invoice.number}</strong> and a new document
            with negated amounts will be created. This cannot be undone. Enter the reason as
            required by IRD.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          className="mt-2"
          placeholder="Reason for credit note (required by IRD)…"
          rows={3}
          value={cnReason}
          onChange={(e) => setCnReason(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isIssuingCn}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isIssuingCn || !cnReason.trim()}
            onClick={(e) => {
              e.preventDefault();
              handleIssueCreditNote();
            }}
          >
            {isIssuingCn ? "Issuing…" : "Issue Credit Note"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Add a payment against <strong>{invoice.number}</strong> — balance due is{" "}
            <Money value={due} />. This doesn't change the original invoice amounts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Amount</Label>
            <DecimalTextInput
              className="mt-1"
              value={paymentAmount}
              onChange={setPaymentAmount}
              placeholder="0.00"
            />
          </div>
          <div className="flex gap-2">
            {(["cash", "qr"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm capitalize ${
                  paymentMethod === m
                    ? "border-primary bg-primary/10 font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isRecordingPayment} onClick={() => setShowPaymentDialog(false)}>
            Cancel
          </Button>
          <Button disabled={isRecordingPayment || paymentAmount <= 0} onClick={handleRecordPayment}>
            {isRecordingPayment ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
