import type { CompanyProfile, Invoice, InvoiceLine } from "@/data/types";

export interface InvoiceTotals {
  gross: number;
  discount: number;
  /** net of taxable items (VAT exclusive) */
  taxable: number;
  /** net of VAT exempt / non-taxable items */
  exempt: number;
  vat: number;
  total: number;
}

type TotalsLine = Pick<InvoiceLine, "qty" | "rate" | "discount"> & {
  taxable?: boolean | undefined;
};

export function lineGross(l: Pick<InvoiceLine, "qty" | "rate" | "discount">) {
  return (l.rate - l.discount) * l.qty;
}

export function isTaxable(l: { taxable?: boolean | undefined }) {
  return l.taxable !== false;
}

// rate is VAT-EXCLUSIVE (see docs/arch.md) — the same convention as
// Product.sellingPrice and Purchase's unit_cost. VAT is added on top of the
// taxable lines' net amount, never backed out of it. A product priced at
// Rs 100 exclusive sells for Rs 113 at 13% VAT, not Rs 100 total.
export function computeTotals(
  lines: TotalsLine[],
  company: Pick<CompanyProfile, "vatRegistered" | "vatRate">,
): InvoiceTotals {
  const gross = lines.reduce((s, l) => s + l.rate * l.qty, 0);
  const discount = lines.reduce((s, l) => s + l.discount * l.qty, 0);
  if (!company.vatRegistered) {
    const total = gross - discount;
    return { gross, discount, taxable: total, exempt: 0, vat: 0, total };
  }
  const taxable = lines.filter(isTaxable).reduce((s, l) => s + lineGross(l), 0);
  const exempt = lines.filter((l) => !isTaxable(l)).reduce((s, l) => s + lineGross(l), 0);
  const vat = (taxable * company.vatRate) / 100;
  const total = taxable + vat + exempt;
  return { gross, discount, taxable, exempt, vat, total };
}

export function invoiceDue(inv: Invoice, total: number) {
  return Math.max(0, total - inv.paidAmount);
}

/** Totals for an ALREADY-SAVED invoice — sums each line's own stored
 *  taxRate/vatAmount snapshot instead of recomputing from today's live
 *  company.vatRegistered/vatRate. This is what print/invoices-list must use:
 *  a bill made while VAT was on must keep showing its real VAT breakdown
 *  even if the company later turns VAT off (and vice versa) — recomputing
 *  live would silently rewrite history. Falls back to live computeTotals
 *  only for lines that predate per-line VAT snapshotting (taxRate/vatAmount
 *  undefined — see IMSInvoiceLine's schema-backfill note in api/core/seed.py). */
export function computeStoredTotals(lines: InvoiceLine[]): InvoiceTotals {
  const gross = lines.reduce((s, l) => s + l.rate * l.qty, 0);
  const discount = lines.reduce((s, l) => s + l.discount * l.qty, 0);
  const taxableLines = lines.filter(isTaxable);
  const exemptLines = lines.filter((l) => !isTaxable(l));
  const taxable = taxableLines.reduce((s, l) => s + lineGross(l), 0);
  const exempt = exemptLines.reduce((s, l) => s + lineGross(l), 0);
  const vat = taxableLines.reduce((s, l) => s + (l.vatAmount ?? 0), 0);
  const total = taxable + vat + exempt;
  return { gross, discount, taxable, exempt, vat, total };
}
