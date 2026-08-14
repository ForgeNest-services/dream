export interface CurrencyDef {
  code: string;
  symbol: string;
  label: string;
  locale: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "NPR", symbol: "Rs", label: "Nepalese Rupee", locale: "en-IN" },
  { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "Euro", locale: "en-IE" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham", locale: "en-US" },
];

export function currencyByCode(code: string): CurrencyDef {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]!;
}

export function formatMoney(value: number, code = "NPR"): string {
  const c = currencyByCode(code);
  const n = new Intl.NumberFormat(c.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
  return `${c.symbol} ${n}`;
}

export function formatQty(value: number, decimals = false): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 3 : 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = TENS[Math.floor(n / 10)] ?? "";
  const o = ONES[n % 10] ?? "";
  return o ? `${t} ${o}` : t;
}

/** Indian/Nepali numbering: lakh & crore. */
export function amountInWords(amount: number, code = "NPR"): string {
  const c = currencyByCode(code);
  const unit = c.code === "NPR" ? "Rupees" : c.code === "INR" ? "Rupees" : c.label;
  const sub = c.code === "NPR" || c.code === "INR" ? "Paisa" : "Cents";
  const whole = Math.floor(Math.abs(amount));
  const frac = Math.round((Math.abs(amount) - whole) * 100);

  if (whole === 0 && frac === 0) return `${unit} Zero Only`;

  const parts: string[] = [];
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const hundred = Math.floor((whole % 1000) / 100);
  const rest = whole % 100;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));

  let out = `${unit} ${parts.join(" ")}`;
  if (frac) out += ` and ${twoDigits(frac)} ${sub}`;
  return `${out} Only`;
}

/** VAT-inclusive price -> taxable + vat split */
export function splitVatInclusive(gross: number, rate = 13) {
  const taxable = gross / (1 + rate / 100);
  return { taxable, vat: gross - taxable };
}
