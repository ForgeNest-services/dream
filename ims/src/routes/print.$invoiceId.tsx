import { IrdQrCode } from "@/components/shared/IrdQrCode";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-store";
import { amountInWords, formatMoney } from "@/lib/format";
import { buildIrdQrPayload } from "@/lib/ird-qr";
import { computeStoredTotals, lineGross } from "@/lib/invoice";
import { invoicesApi } from "@/lib/invoices-api";
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
  // IRD: registering this print with the server is what actually decides
  // whether it's a reprint (Electronic Billing Procedure 2082, clause
  // 6.2(च)) — not the cosmetic original/copy toggle above, which is purely
  // a display preference for a first-time print. Registers once per page
  // visit (not once per window.print() click) so opening the page, then
  // clicking Print multiple times for the same physical printout, doesn't
  // rack up phantom reprint counts.
  const [serverReprint, setServerReprint] = useState<{ isReprint: boolean; reprintNumber: number | null } | null>(
    null,
  );

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

  useEffect(() => {
    if (!inv || inv.kind === "quotation") return;
    invoicesApi
      .registerPrint(invoiceId)
      .then((res) => {
        if (res.data) {
          setServerReprint({
            isReprint: res.data.is_reprint,
            reprintNumber: res.data.reprint_number,
          });
        }
      })
      .catch(() => {
        // Non-fatal — worst case the watermark falls back to whatever was
        // already stored on the invoice (see reprintLabel below).
      });
    // Only re-register if the user navigates to a genuinely different
    // invoice, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, inv?.kind]);

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
  const t = computeStoredTotals(inv.lines);
  const date = new Date(inv.date);
  const isQuote = inv.kind === "quotation";
  const hasVat = t.vat > 0;
  const displayVatRate = inv.lines.find((l) => l.taxable !== false && l.taxRate)?.taxRate ?? c.vatRate;
  const docTitle = isQuote
    ? "Quotation / कोटेशन"
    : hasVat
      ? inv.kind === "abbreviated"
        ? "Abbreviated Tax Invoice / संक्षिप्त कर बीजक"
        : "Tax Invoice / कर बीजक"
      : "Invoice / बीजक";
  const isThermal = size === "thermal";

  // IRD: use snapshotted seller info (captured at issue time) — the live
  // company profile may have changed since, but the bill must reflect what
  // was true when it was issued.
  const sellerName = inv.sellerName ?? c.legalName;
  const sellerAddress = inv.sellerAddress ?? c.address;
  const sellerPan = inv.sellerPan ?? c.pan;

  // IRD Annex 5: buyer PAN/name from snapshot. Prefer snapshot over live
  // party data so a customer record update can't silently alter a filed bill.
  const buyerName = inv.buyerName ?? cust?.name;
  const buyerPan = inv.buyerPan ?? cust?.pan;

  // IRD reprint watermark (Electronic Billing Procedure 2082, clause
  // 6.2(च)) — driven by the server's registerPrint response (the real,
  // authoritative reprint decision), falling back to the invoice's
  // already-stored flags for the brief moment before that call resolves.
  // Never driven by the cosmetic original/copy toggle — a reprint is a
  // distinct legal event, not a display preference.
  const isReprint = serverReprint?.isReprint ?? inv.isReprint ?? false;
  const reprintNumber = serverReprint?.reprintNumber ?? inv.reprintNumber ?? 1;
  const reprintLabel = isReprint
    ? `Copy of Original (${reprintNumber})`
    : copy === "original"
      ? "Original Copy"
      : "Copy of Original";

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
          <h1 className="text-lg font-semibold uppercase tracking-wide">{sellerName}</h1>
          <p>{sellerAddress}</p>
          <p>
            Tel: {c.phone} · {c.email}
          </p>
          <p className="font-medium">
            {hasVat ? "VAT No." : "PAN No."} {sellerPan}
          </p>
        </div>

        <div className={`my-3 ${isThermal ? "text-left" : "text-center"}`}>
          <p className="inline-block border border-black/70 px-3 py-1 text-sm font-semibold uppercase">
            {docTitle}
          </p>
          {inv.isCreditNote && (
            <p className="mt-0.5 text-xs font-semibold uppercase text-red-700">Credit Note</p>
          )}
          <p className="mt-1 text-xs uppercase tracking-widest">{reprintLabel}</p>
        </div>

        <div className={`grid gap-2 border-y border-black/30 py-2 text-xs ${isThermal ? "" : "sm:grid-cols-2"}`}>
          <div>
            <p>
              <span className="font-medium">Buyer:</span> {buyerName ?? "Walk-in customer"}
            </p>
            {inv.buyerAddress ? <p>{inv.buyerAddress}</p> : cust?.address ? <p>{cust.address}</p> : null}
            {buyerPan ? (
              <p>
                <span className="font-medium">PAN:</span> {buyerPan}
              </p>
            ) : null}
            {cust?.phone ? <p>Tel: {cust.phone}</p> : null}
          </div>
          <div className={isThermal ? "mt-1" : "sm:text-right"}>
            <p>
              <span className="font-medium">No.:</span> {inv.number}
            </p>
            <p>
              <span className="font-medium">Date (BS):</span> {formatBs(date, "long")}
            </p>
            <p>
              <span className="font-medium">Date (AD):</span> {formatAd(date, "long")}
            </p>
            {isThermal ? (
              <p>
                <span className="font-medium">Branch:</span>
                <br />
                {branch?.name}
              </p>
            ) : (
              <p>
                <span className="font-medium">Branch:</span> {branch?.name}
              </p>
            )}
            {inv.enteredByName && (
              <p>
                <span className="font-medium">Entered by:</span> {inv.enteredByName}
              </p>
            )}
          </div>
        </div>

        {isThermal ? (
          <div className="mt-3 border-y border-black/70 py-1">
            {inv.lines.map((l, idx) => (
              <div key={l.id} className="mb-1.5 border-b border-black/20 pb-1.5 last:mb-0 last:border-0 last:pb-0">
                <p>
                  {idx + 1}. {l.description}
                  {hasVat && l.taxable === false ? (
                    <span className="ml-1 text-[9px] uppercase text-black/60">(non-taxable)</span>
                  ) : null}
                </p>
                {l.hsCode && <p className="text-[10px] text-black/60">HS: {l.hsCode}</p>}
                <div className="flex justify-between">
                  <span>
                    {l.qty} {app.unitSymbol(l.unitId)} × {formatMoney(l.rate, app.currency)}
                  </span>
                  <span>{formatMoney(lineGross(l), app.currency)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="mt-3 w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-black/70">
                <th className="px-1 py-1.5 text-left">S.N.</th>
                <th className="px-1 py-1.5 text-left">Particulars / विवरण</th>
                <th className="px-1 py-1.5 text-left">HS Code</th>
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
                    {hasVat && l.taxable === false ? (
                      <span className="ml-1 text-[9px] uppercase text-black/60">(non-taxable)</span>
                    ) : null}
                  </td>
                  <td className="px-1 py-1.5">{l.hsCode || "—"}</td>
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
        )}

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
            {hasVat && (
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
                  <dt>VAT @ {displayVatRate}%</dt>
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

        <div className={`mt-3 flex items-start gap-4 ${isThermal ? "flex-col items-center" : "justify-between"}`}>
          {!isQuote && (
            <div className="text-center">
              <IrdQrCode
                data={buildIrdQrPayload({
                  sellerPan,
                  isVatRegistered: c.vatRegistered,
                  billNumber: inv.number,
                  billDateBs: formatBs(date, "long"),
                  buyerPan,
                  taxableAmount: hasVat ? t.taxable : t.total,
                  taxAmount: t.vat,
                  totalAmount: t.total,
                  // No confirmed IRD verification-URL format exists yet
                  // (not in the procedure text, not in CBMS's response) —
                  // omitted rather than guessed. Wire this up once IRD
                  // publishes/confirms the scheme during certification.
                })}
                size={132}
              />
              <p className="mt-1 text-[9px] text-black/60">Scan to verify bill details</p>
            </div>
          )}
          {c.qrImageUrl && inv.paymentMethod === "qr" ? (
            <div className="text-center">
              <img
                src={c.qrImageUrl}
                alt="Payment QR code"
                className="mx-auto h-24 w-24 object-contain"
              />
              <p className="text-[10px]">Scan to pay</p>
            </div>
          ) : null}
        </div>

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
