"""Bikram Sambat (Nepali calendar) conversion.

Anchor: 2075-01-01 BS === 2018-04-14 AD.

Kept in sync with rms/src/lib/pos/nepali-date.ts — same anchor, same
month-length table. When you extend the calendar past 2090 BS on either side,
update both files together.

Storage convention: BS dates in the DB are stored as VARCHAR(10) strings in
"YYYY-MM-DD" shape (e.g. "2083-05-27"), zero-padded on month + day. Sorts
lexically, matches ISO Gregorian format so no separate parsing story is
needed on the client.
"""

from datetime import date, datetime, timezone, timedelta


# Business timezone. Every BS calendar-day decision (which BS date does a
# given UTC timestamp fall on?) is anchored to Nepal Standard Time — the
# hotel/restaurant runs on NPT, not on the server's TZ. NPT is UTC+05:45
# and doesn't observe DST, so a fixed offset is safe (no need for zoneinfo).
NEPAL_TZ = timezone(timedelta(hours=5, minutes=45), name="NPT")


# Month-length lookup table. Each list is the 12 month-lengths for that BS
# year. Sourced from HMG Nepal calendar; keep this in sync with the JS one.
BS_CALENDAR: dict[int, list[int]] = {
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
    for DB storage. Returns None if the input is None or out of range.

    Datetimes are converted to NPT before the calendar-day is extracted, so
    a bill closed at 23:59 NPT gets the same BS date whether the server is
    in Kathmandu, UTC, or Los Angeles. A naive datetime is assumed to be UTC
    (matches the app's write convention — SQLAlchemy sometimes hands naive
    UTCs back through .refresh())."""
    if g_or_dt is None:
        return None
    if isinstance(g_or_dt, datetime):
        aware = g_or_dt if g_or_dt.tzinfo else g_or_dt.replace(tzinfo=timezone.utc)
        g = aware.astimezone(NEPAL_TZ).date()
    else:
        g = g_or_dt
    bs = to_bs(g)
    if bs is None:
        return None
    y, m, d = bs
    return f"{y:04d}-{m:02d}-{d:02d}"


def bs_iso_to_ad(bs_iso: str | None) -> date | None:
    """Reverse of to_bs_iso for whole calendar days. Takes a "YYYY-MM-DD" BS
    string and returns the corresponding Gregorian date. Used by report
    day-walkers that need to iterate a BS range (BS months have variable
    length so we can't just add days-of-month directly)."""
    if not bs_iso:
        return None
    try:
        parts = bs_iso.split("-")
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
    except (ValueError, IndexError):
        return None
    if m < 1 or m > 12 or d < 1:
        return None
    if y < 2075 or y not in BS_CALENDAR:
        return None
    months = BS_CALENDAR[y]
    if d > months[m - 1]:
        return None
    diff = 0
    year = 2075
    while year < y:
        months_y = BS_CALENDAR.get(year)
        if months_y is None:
            return None
        diff += sum(months_y)
        year += 1
    diff += sum(months[: m - 1])
    diff += d - 1
    return _ANCHOR + timedelta(days=diff)


def format_bs_pretty(g_or_dt: date | datetime | None) -> str:
    """Human-readable BS date, e.g. "Bhadra 27, 2083 BS". Empty string on
    out-of-range or None input."""
    iso = to_bs_iso(g_or_dt)
    if not iso:
        return ""
    y, m, d = iso.split("-")
    return f"{NEPALI_MONTHS[int(m) - 1]} {int(d)}, {int(y)} BS"
