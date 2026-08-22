/**
 * Minimal Bikram Sambat (BS) <-> Gregorian (AD) converter.
 * Covers BS 2075-01-01 (AD 2018-04-14) through BS 2090.
 */

export const BS_MONTHS = [
  "Baishakh",
  "Jestha",
  "Ashad",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

// Kept in sync with api/utils/bikram_sambat.py and rms/src/lib/pos/nepali-date.ts
// (same anchor, same HMG-sourced month lengths) — when extending past 2090 BS
// on either side, update all three files together. IMS's table previously
// disagreed with the other two in several years (2076/2077/2080/2081/2089/2090);
// reconciled to match, since those are the values api/utils/bikram_sambat.py
// actually uses to compute date_bs server-side.
const DAYS: Record<number, number[]> = {
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30],
  2079: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2083: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 29, 31],
  2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 29, 31],
  2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 29, 31],
  2089: [30, 31, 32, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [30, 31, 32, 32, 31, 30, 30, 30, 29, 30, 29, 31],
};

const BASE_BS_YEAR = 2075;
/** AD date matching BS 2075-01-01 */
const BASE_AD = Date.UTC(2018, 3, 14);
const MS_PER_DAY = 86400000;

export interface BsDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-32
}

export function bsDaysInMonth(year: number, month: number): number {
  return DAYS[year]?.[month - 1] ?? 30;
}

export function bsYears(): number[] {
  return Object.keys(DAYS).map(Number);
}

/** Convert an AD Date to BS. */
export function adToBs(date: Date): BsDate {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  let remaining = Math.floor((utc - BASE_AD) / MS_PER_DAY);
  let year = BASE_BS_YEAR;
  let month = 1;
  let day = 1;
  while (remaining > 0) {
    const dim = bsDaysInMonth(year, month);
    if (remaining >= dim - day + 1) {
      remaining -= dim - day + 1;
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    } else {
      day += remaining;
      remaining = 0;
    }
  }
  return { year, month, day };
}

/** Convert a BS date to an AD Date. */
export function bsToAd(bs: BsDate): Date {
  let days = 0;
  for (let y = BASE_BS_YEAR; y < bs.year; y++) {
    days += (DAYS[y] ?? []).reduce((a, b) => a + b, 0);
  }
  for (let m = 1; m < bs.month; m++) days += bsDaysInMonth(bs.year, m);
  days += bs.day - 1;
  return new Date(BASE_AD + days * MS_PER_DAY);
}

export function formatBs(date: Date, style: "short" | "long" = "short"): string {
  const bs = adToBs(date);
  if (style === "long") {
    return `${bs.day} ${BS_MONTHS[bs.month - 1]} ${bs.year}`;
  }
  return `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(bs.day).padStart(2, "0")}`;
}

export function formatAd(date: Date, style: "short" | "long" = "short"): string {
  if (style === "long") {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** Nepali fiscal year label (Shrawan 1 -> Ashad end) for a date. */
export function fiscalYearBs(date: Date): string {
  const bs = adToBs(date);
  const start = bs.month >= 4 ? bs.year : bs.year - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
