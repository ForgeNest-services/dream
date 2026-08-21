"""Minimal Bikram Sambat (BS) year calculator — trimmed to only what the
fiscal-year auto-seed needs: today's BS year and month. Kept in sync with
api/utils/bikram_sambat.py (the authoritative table — same anchor, same
HMG-sourced month lengths) and rms/src/lib/pos/nepali-date.ts; this file
previously diverged from both (2076/2077/2078/2080/2081/2089/2090 had wrong
day counts) since it was ported before that table was corrected — update all
three together when extending past 2090 BS."""

from datetime import date, timedelta

DAYS: dict[int, list[int]] = {
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

BASE_BS_YEAR = 2075
BASE_AD = date(2018, 4, 14)  # AD date matching BS 2075-01-01


def bs_days_in_month(year: int, month: int) -> int:
    return DAYS.get(year, [30] * 12)[month - 1]


def ad_to_bs_year_month(ad_date: date) -> tuple[int, int]:
    """Returns (bs_year, bs_month) for the given AD date."""
    remaining = (ad_date - BASE_AD).days
    year = BASE_BS_YEAR
    month = 1
    day = 1
    while remaining > 0:
        dim = bs_days_in_month(year, month)
        if remaining >= dim - day + 1:
            remaining -= dim - day + 1
            day = 1
            month += 1
            if month > 12:
                month = 1
                year += 1
        else:
            day += remaining
            remaining = 0
    return year, month


def current_fiscal_year_start() -> int:
    """The BS start_year of the fiscal year containing today (Shrawan 1
    through Ashad end) — month 4 (Shrawan) or later means the current BS
    year is the start year; earlier months belong to the prior FY."""
    bs_year, bs_month = ad_to_bs_year_month(date.today())
    return bs_year if bs_month >= 4 else bs_year - 1
