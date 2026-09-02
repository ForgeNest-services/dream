/**
 * Dynamic QR code for printed bills — Electronic Billing Procedure 2082,
 * clause 6.2(ङ). Required fields per the procedure text:
 *   अ. Seller PAN/VAT   आ. Bill number + date   इ. Buyer PAN/VAT (if available)
 *   ई. Total + tax details   उ. URL link (only once the issuer is CBMS-integrated)
 *
 * IRD hasn't published a fixed machine-readable schema for this QR (no
 * sample payload in the procedure or any doc in this repo) — a scanner is
 * only asked to make the same fields "readable" offline, and to resolve a
 * URL online once CBMS sync exists. So this encodes a plain, labeled text
 * block rather than inventing a JSON/URL shape IRD never specified. Once a
 * real IRD verification-URL format is confirmed (expected during CBMS
 * certification), swap `buildIrdQrPayload` to emit that URL instead —
 * everything else here (the field list, the label order) stays correct.
 */

export interface IrdQrFields {
  sellerPan: string | null | undefined;
  isVatRegistered: boolean;
  billNumber: string;
  /** BS-formatted date string, e.g. "Kartik 5, 2082 BS" */
  billDateBs: string;
  buyerPan?: string | null;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  /** Only set once this bill has actually been accepted by CBMS. */
  cbmsVerifyUrl?: string | null;
}

export function buildIrdQrPayload(f: IrdQrFields): string {
  const lines = [
    `${f.isVatRegistered ? "VAT" : "PAN"}: ${f.sellerPan ?? "N/A"}`,
    `Bill: ${f.billNumber} | ${f.billDateBs}`,
  ];
  if (f.buyerPan) lines.push(`Buyer PAN: ${f.buyerPan}`);
  lines.push(`Taxable: ${f.taxableAmount.toFixed(2)} | Tax: ${f.taxAmount.toFixed(2)} | Total: ${f.totalAmount.toFixed(2)}`);
  if (f.cbmsVerifyUrl) lines.push(f.cbmsVerifyUrl);
  return lines.join("\n");
}
