from typing import TypedDict


MIN_PER_PAGE = 10
MAX_PER_PAGE = 100
DEFAULT_PER_PAGE = 25


class PageParams(TypedDict):
    page: int
    per_page: int
    offset: int
    limit: int


class PageMeta(TypedDict):
    total: int
    page: int
    per_page: int
    total_pages: int


def parse_paging(page: int | None, per_page: int | None) -> PageParams:
    p = page if page and page > 0 else 1
    pp = per_page if per_page else DEFAULT_PER_PAGE
    pp = max(MIN_PER_PAGE, min(MAX_PER_PAGE, pp))
    return {"page": p, "per_page": pp, "offset": (p - 1) * pp, "limit": pp}


def build_meta(total: int, page: int, per_page: int) -> PageMeta:
    total_pages = max(1, (total + per_page - 1) // per_page)
    safe_page = min(page, total_pages)
    return {
        "total": total,
        "page": safe_page,
        "per_page": per_page,
        "total_pages": total_pages,
    }
