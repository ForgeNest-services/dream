// Bikram Sambat conversion. Anchor: 2075-01-01 BS === 2018-04-14 AD.
// Exported so BsDatePicker can look up days-per-month directly. Keep in sync
// with api/utils/bikram_sambat.py — when extending past 2090 BS on either
// side, update both files together.
export const BS_CALENDAR: Record<number, number[]> = {
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

// Business timezone. Every date/time the UI shows is in Nepal Standard Time
// (UTC+05:45, no DST) — a POS should always display the restaurant's local
// clock, never the viewer's browser TZ. Also anchors BS calendar-day
// decisions so a bill closed at 23:59 NPT doesn't roll into the next BS
// date just because the viewer's browser happens to be in the US.
const NPT_TZ = "Asia/Kathmandu";

const ANCHOR_AD = Date.UTC(2018, 3, 14);
const MS_PER_DAY = 86400000;

export type BsDate = { year: number; month: number; day: number };

// Extract year/month/day of a Date in NPT (not in the browser's local TZ).
// Uses Intl to avoid any manual offset math — handles the +05:45 offset
// correctly regardless of where the code runs (browser, Node SSR, etc.).
function nptYmd(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NPT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { y: get("year"), m: get("month"), day: get("day") };
}

export function toBikramSambat(date: Date): BsDate | null {
  const { y, m, day } = nptYmd(date);
  const utc = Date.UTC(y, m - 1, day);
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
    timeZone: NPT_TZ,
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

// Compact Gregorian date with time, e.g. "12 Aug, 14:30" — always in NPT.
export function formatGregorianShort(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: NPT_TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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
  // For a "YYYY-MM-DD" input, treat it as the calendar day itself (no time
  // component), rendered as NPT — avoids the UTC-midnight-rolling-back
  // problem where "2026-08-13" would render as "12 Aug" for anyone west of
  // NPT.
  const d = typeof input === "string" ? new Date(`${input}T00:00:00+05:45`) : input;
  if (Number.isNaN(d.getTime())) return "";
  const g = d.toLocaleDateString("en-GB", {
    timeZone: NPT_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const bs = formatBikramSambatShort(d);
  return bs ? `${g} · ${bs} BS` : g;
}

// Gregorian Date -> BS ISO string ("YYYY-MM-DD") suitable for sending as a
// bs_from / bs_to query param. Returns null if out of calendar range.
export function toBsIso(g: Date): string | null {
  const bs = toBikramSambat(g);
  if (!bs) return null;
  return `${bs.year.toString().padStart(4, "0")}-${bs.month.toString().padStart(2, "0")}-${bs.day.toString().padStart(2, "0")}`;
}

// Convert a BS ISO string to a human-readable label ("Bhadra 27, 2083 BS").
// Used to show the BS equivalent under Gregorian date pickers.
export function bsIsoToPretty(bsIso: string | null | undefined): string {
  if (!bsIso) return "";
  const [y, m, d] = bsIso.split("-");
  const month = NEPALI_MONTHS[Number(m) - 1] ?? m;
  return `${month} ${Number(d)}, ${Number(y)} BS`;
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
