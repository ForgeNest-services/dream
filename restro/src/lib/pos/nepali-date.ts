// Bikram Sambat conversion. Anchor: 2075-01-01 BS === 2018-04-14 AD.
const BS_CALENDAR: Record<number, number[]> = {
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 31],
  2079: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 29, 31],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
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

export const NEPALI_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

const ANCHOR_AD = Date.UTC(2018, 3, 14);
const MS_PER_DAY = 86400000;

export type BsDate = { year: number; month: number; day: number };

export function toBikramSambat(date: Date): BsDate | null {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  let diff = Math.floor((utc - ANCHOR_AD) / MS_PER_DAY);
  if (diff < 0) return null;

  let year = 2075;
  let month = 0;
  while (true) {
    const months = BS_CALENDAR[year];
    if (!months) return null;
    const len = months[month] ?? 30;
    if (diff < len) return { year, month: month + 1, day: diff + 1 };
    diff -= len;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
}

export function formatBikramSambat(date: Date): string {
  const bs = toBikramSambat(date);
  if (!bs) return "";
  return `${NEPALI_MONTHS[bs.month - 1]} ${bs.day}, ${bs.year} BS`;
}

export function formatGregorian(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Compact BS date, e.g. "Bhadra 27, 2083". Used inline in list columns.
export function formatBikramSambatShort(date: Date): string {
  const bs = toBikramSambat(date);
  if (!bs) return "";
  return `${NEPALI_MONTHS[bs.month - 1]} ${bs.day}, ${bs.year}`;
}

// Compact Gregorian date with time, e.g. "12 Aug, 14:30".
export function formatGregorianShort(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// One-line "Gregorian · BS" for order rows / cards / audit logs. Falls back
// to Gregorian only if the date is outside the BS calendar table range.
export function formatDateWithBs(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const g = formatGregorianShort(d);
  const bs = formatBikramSambatShort(d);
  return bs ? `${g} · ${bs} BS` : g;
}

// Date-only variant for form inputs / labels (no time). Takes a "YYYY-MM-DD"
// string or a Date. Returns e.g. "12 Aug 2026 · Bhadra 27, 2083 BS".
export function formatDateOnlyWithBs(input: string | Date): string {
  const d = typeof input === "string" ? new Date(`${input}T00:00:00`) : input;
  if (Number.isNaN(d.getTime())) return "";
  const g = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const bs = formatBikramSambatShort(d);
  return bs ? `${g} · ${bs} BS` : g;
}

// Prefer this over formatDateWithBs when the record already carries a
// backend-computed `*_bs` string. Uses the stored BS date verbatim so a
// receipt / report always shows the exact BS date the row was stamped with.
// Falls back to Gregorian only if BS is missing (pre-migration rows, etc.).
export function formatDateWithStoredBs(
  g: Date | number,
  bs: string | null | undefined,
): string {
  const gStr = formatGregorianShort(typeof g === "number" ? new Date(g) : g);
  if (!bs) return gStr;
  const [y, m, d] = bs.split("-");
  const month = NEPALI_MONTHS[Number(m) - 1] ?? m;
  return `${gStr} · ${month} ${Number(d)}, ${Number(y)} BS`;
}
