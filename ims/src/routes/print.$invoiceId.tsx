import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-store";
import { amountInWords, formatMoney } from "@/lib/format";
import { computeTotals, lineGross } from "@/lib/invoice";
import { formatAd, formatBs } from "@/lib/nepali-date";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/print/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Print Invoice — SROTA IMS" },
      {
        name: "description",
        content:
          "Printable IRD-compliant tax invoice with seller PAN/VAT, buyer details, VAT breakdown and amount in words.",
      },
      { property: "og:title", content: "Print Invoice — SROTA IMS" },
      {
        property: "og:description",
        content: "A4 and 80mm thermal print layouts for IRD-compliant invoices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrintInvoicePage,
});

function PrintInvoicePage() {
  const app = useApp();
  const { invoiceId } = useParams({ from: "/print/$invoiceId" });
  const [size, setSize] = useState<"a4" | "thermal">("thermal");
  const [copy, setCopy] = useState<"original" | "copy">("original");

  // @page is a document-level at-rule — it can't be scoped by a CSS class,
  // so switching between A4 and 80mm needs a JS-injected <style> that's
  // updated whenever the toggle changes (same technique RMS's
  // MenuQrPrintButton uses to override its thermal-receipt default).
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent =
      size === "thermal"
        ? "@media print { @page { size: 80mm auto; margin: 0; } }"
        : "@media print { @page { size: A4 portrait; margin: 0; } }";
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [size]);

  const inv = app.invoices.find((i) => i.id === invoiceId);
  if (!inv) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-center">
        <div>
          <p className="font-medium">Invoice not found</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/sales/invoices">Back to invoices</Link>
          </Button>
        </div>
      </div>
    );
  }

  const c = app.company;
  const cust = app.parties.find((p) => p.id === inv.customerId);
  const branch = app.branches.find((b) => b.id === inv.branchId);
  const t = computeTotals(inv.lines, c);
  const date = new Date(inv.date);
  const isQuote = inv.kind === "quotation";
  const docTitle = isQuote
    ? "Quotation / कोटेशन"
    : c.vatRegistered
      ? inv.kind === "abbreviated"
        ? "Abbreviated Tax Invoice / संक्षिप्त कर बीजक"
        : "Tax Invoice / कर बीजक"
      : "Invoice / बीजक";
  const isThermal = size === "thermal";

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center justify-between gap-2 px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/sales/invoices">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-card p-0.5">
            {(["a4", "thermal"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`rounded px-2.5 py-1 text-xs ${size === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {s === "a4" ? "A4" : "80mm"}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border bg-card p-0.5">
            {(["original", "copy"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setCopy(s)}
                className={`rounded px-2.5 py-1 text-xs capitalize ${copy === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <div
        className={`mx-auto bg-white text-black shadow-sm print:absolute print:inset-0 print:m-0 print:shadow-none ${
          isThermal ? "max-w-[302px] p-2 text-left text-[11px]" : "max-w-[820px] p-6 text-[13px]"
        }`}
      >
        <div className={`border-b border-black/70 pb-3 ${isThermal ? "text-left" : "text-center"}`}>
          <h1 className="text-lg font-semibold uppercase tracking-wide">{c.legalName}</h1>
          <p>{c.address}</p>
          <p>
            Tel: {c.phone} · {c.email}
          </p>
          <p className="font-medium">
            {c.vatRegistered ? "VAT No." : "PAN No."} {c.pan}
          </p>
        </div>

        <div className={`my-3 ${isThermal ? "text-left" : "text-center"}`}>
          <p className="inline-block border border-black/70 px-3 py-1 text-sm font-semibold uppercase">
            {docTitle}
          </p>
          <p className="mt-1 text-xs uppercase tracking-widest">
            {copy === "original" ? "Original Copy" : "Copy of Original"}
          </p>
        </div>

        <div className="grid gap-2 border-y border-black/30 py-2 text-xs sm:grid-cols-2">
          <div>
            <p>
              <span className="font-medium">Buyer:</span> {cust?.name ?? "Walk-in customer"}
            </p>
            <p>{cust?.address}</p>
            {cust?.pan ? (
              <p>
                <span className="font-medium">{cust.isVatRegistered ? "VAT" : "PAN"}:</span>{" "}
                {cust.pan}
              </p>
            ) : null}
            {cust?.phone ? <p>Tel: {cust.phone}</p> : null}
          </div>
          <div className="sm:text-right">
            <p>
              <span className="font-medium">No.:</span> {inv.number}
            </p>
            <p>
              <span className="font-medium">Date (BS):</span> {formatBs(date, "long")}
            </p>
            <p>
              <span className="font-medium">Date (AD):</span> {formatAd(date, "long")}
            </p>
            <p>
              <span className="font-medium">Branch:</span> {branch?.name}
            </p>
          </div>
        </div>

        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-black/70">
              <th className="px-1 py-1.5 text-left">S.N.</th>
              <th className="px-1 py-1.5 text-left">Particulars / विवरण</th>
              <th className="px-1 py-1.5 text-right">Qty</th>
              <th className="px-1 py-1.5 text-right">Rate</th>
              <th className="px-1 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, idx) => (
              <tr key={l.id} className="border-b border-black/20">
                <td className="px-1 py-1.5">{idx + 1}</td>
                <td className="px-1 py-1.5">
                  {l.description}
                  {c.vatRegistered && l.taxable === false ? (
                    <span className="ml-1 text-[9px] uppercase text-black/60">(non-taxable)</span>
                  ) : null}
                </td>
                <td className="px-1 py-1.5 text-right">
                  {l.qty} {app.unitSymbol(l.unitId)}
                </td>
                <td className="px-1 py-1.5 text-right">{formatMoney(l.rate, app.currency)}</td>
                <td className="px-1 py-1.5 text-right">
                  {formatMoney(lineGross(l), app.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={`mt-3 flex ${isThermal ? "" : "justify-end"}`}>
          <dl className={`space-y-1 text-xs ${isThermal ? "w-full" : "w-full max-w-xs"}`}>
            <div className="flex justify-between">
              <dt>Sub total</dt>
              <dd>{formatMoney(t.gross, app.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>{formatMoney(t.discount, app.currency)}</dd>
            </div>
            {c.vatRegistered && (
              <>
                {t.exempt > 0 ? (
                  <div className="flex justify-between">
                    <dt>Non-taxable amount</dt>
                    <dd>{formatMoney(t.exempt, app.currency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt>Taxable amount</dt>
                  <dd>{formatMoney(t.taxable, app.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>VAT @ {c.vatRate}%</dt>
                  <dd>{formatMoney(t.vat, app.currency)}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-black/70 pt-1 text-sm font-semibold">
              <dt>Grand total</dt>
              <dd>{formatMoney(t.total, app.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Paid ({inv.paymentMethod})</dt>
              <dd>{formatMoney(inv.paidAmount, app.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Balance due</dt>
              <dd>{formatMoney(Math.max(0, t.total - inv.paidAmount), app.currency)}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-3 border-y border-black/30 py-2 text-xs">
          <span className="font-medium">In words:</span> {amountInWords(t.total, app.currency)}
        </p>

        {c.qrImageUrl && inv.paymentMethod === "qr" ? (
          <div className="mt-3 text-center">
            <img
              src={c.qrImageUrl}
              alt="Payment QR code"
              className="mx-auto h-24 w-24 object-contain"
            />
            <p className="text-[10px]">Scan to pay</p>
          </div>
        ) : null}

        <div className="mt-8 flex justify-between text-xs">
          <p className="border-t border-black/70 pt-1">Received by</p>
          <p className="border-t border-black/70 pt-1">For {c.name}</p>
        </div>
        <p className="mt-4 text-center text-[10px] text-black/60">
          {isQuote
            ? "This quotation is valid for 15 days from the date of issue."
            : "This is a computer generated invoice issued as per IRD regulations."}
        </p>
      </div>
    </div>
  );
}
