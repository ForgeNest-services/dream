import type { CompanyProfile, Invoice, InvoiceLine } from "@/data/types";
import { splitVatInclusive } from "@/lib/format";

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

export function computeTotals(
  lines: TotalsLine[],
  company: Pick<CompanyProfile, "vatRegistered" | "vatRate">,
): InvoiceTotals {
  const gross = lines.reduce((s, l) => s + l.rate * l.qty, 0);
  const discount = lines.reduce((s, l) => s + l.discount * l.qty, 0);
  const total = gross - discount;
  if (!company.vatRegistered) {
    return { gross, discount, taxable: total, exempt: 0, vat: 0, total };
  }
  const taxableNet = lines.filter(isTaxable).reduce((s, l) => s + lineGross(l), 0);
  const exempt = lines.filter((l) => !isTaxable(l)).reduce((s, l) => s + lineGross(l), 0);
  const { taxable, vat } = splitVatInclusive(taxableNet, company.vatRate);
  return { gross, discount, taxable, exempt, vat, total };
}

export function invoiceDue(inv: Invoice, total: number) {
  return Math.max(0, total - inv.paidAmount);
}
