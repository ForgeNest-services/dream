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
