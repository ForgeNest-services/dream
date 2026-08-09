"""Bikram Sambat (Nepali calendar) conversion.

Anchor: 2075-01-01 BS === 2018-04-14 AD.

Kept in sync with restro/src/lib/pos/nepali-date.ts — same anchor, same
month-length table. When you extend the calendar past 2090 BS on either side,
update both files together.

Storage convention: BS dates in the DB are stored as VARCHAR(10) strings in
"YYYY-MM-DD" shape (e.g. "2083-05-27"), zero-padded on month + day. Sorts
lexically, matches ISO Gregorian format so no separate parsing story is
needed on the client.
"""

from datetime import date, datetime, timezone


# Month-length lookup table. Each list is the 12 month-lengths for that BS
# year. Sourced from HMG Nepal calendar; keep this in sync with the JS one.
BS_CALENDAR: dict[int, list[int]] = {
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
}

NEPALI_MONTHS = [
    "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
]

_ANCHOR = date(2018, 4, 14)  # 2075-01-01 BS


def to_bs(g: date) -> tuple[int, int, int] | None:
    """Convert a Gregorian date to a (year, month, day) BS tuple. Returns
    None if the date is before the anchor or past the calendar table."""
    diff = (g - _ANCHOR).days
    if diff < 0:
        return None
    year = 2075
    month_idx = 0
    while True:
        months = BS_CALENDAR.get(year)
        if months is None:
            return None
        length = months[month_idx]
        if diff < length:
            return year, month_idx + 1, diff + 1
        diff -= length
        month_idx += 1
        if month_idx > 11:
            month_idx = 0
            year += 1


def to_bs_iso(g_or_dt: date | datetime | None) -> str | None:
    """Format a Gregorian date/datetime as a BS "YYYY-MM-DD" string suitable
    for DB storage. Returns None if the input is None or out of range."""
    if g_or_dt is None:
        return None
    if isinstance(g_or_dt, datetime):
        # Normalize to UTC calendar-day. All timestamps in the app are stored
        # UTC; using UTC for the calendar conversion keeps display consistent.
        g = g_or_dt.astimezone(timezone.utc).date() if g_or_dt.tzinfo else g_or_dt.date()
    else:
        g = g_or_dt
    bs = to_bs(g)
    if bs is None:
        return None
    y, m, d = bs
    return f"{y:04d}-{m:02d}-{d:02d}"


def format_bs_pretty(g_or_dt: date | datetime | None) -> str:
    """Human-readable BS date, e.g. "Bhadra 27, 2083 BS". Empty string on
    out-of-range or None input."""
    iso = to_bs_iso(g_or_dt)
    if not iso:
        return ""
    y, m, d = iso.split("-")
    return f"{NEPALI_MONTHS[int(m) - 1]} {int(d)}, {int(y)} BS"
