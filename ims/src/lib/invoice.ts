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
