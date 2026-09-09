from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import get_current_user
from core.rate_limit import rate_limit
from core.queue import job_queue
from utils.helpers import success_response
from utils.paging import parse_paging, build_meta
from features.queries.schemas import SubmitQueryRequest, QueryData
from features.queries.repository import QueryRepository
from jobs.email_jobs import send_query_autoreply_email

router = APIRouter(prefix="/queries", tags=["queries"])


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    if not current_user or current_user.get("type") != "superadmin":
        raise HTTPException(403, "Superadmin only")
    return current_user


@router.post("")
def submit_query(
    data: SubmitQueryRequest,
    db: Session = Depends(get_db),
    _: None = rate_limit("public_forms"),
):
    """Public, unauthenticated -- ui/contact.html's contact form. Every
    submission gets an auto-reply email; superadmin reads submissions via
    GET /queries/admin."""
    query = QueryRepository.create(
        db,
        name=data.name,
        email=data.email,
        message=data.message,
        business_name=data.business_name,
        phone=data.phone,
        app_interest=data.app_interest,
    )
    job_queue.enqueue(
        send_query_autoreply_email,
        recipient_email=query.email,
        recipient_name=query.name,
    )
    return success_response(
        message="Thanks for reaching out — we'll get back to you within a day.",
    )


@router.get("/admin")
def admin_list_queries(
    page: int = 1,
    per_page: int = 25,
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    paging = parse_paging(page, per_page)
    items, total = QueryRepository.list_paginated(db, paging["offset"], paging["limit"])
    return success_response(
        data=[QueryData.model_validate(q).model_dump(mode="json") for q in items],
        meta=build_meta(total, paging["page"], paging["per_page"]),
    )
