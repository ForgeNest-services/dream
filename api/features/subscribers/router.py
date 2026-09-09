from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import get_current_user
from core.rate_limit import rate_limit
from utils.helpers import success_response
from utils.paging import parse_paging, build_meta
from features.subscribers.schemas import SubscribeRequest, SubscriberData
from features.subscribers.repository import SubscriberRepository

router = APIRouter(prefix="/subscribers", tags=["subscribers"])


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    if not current_user or current_user.get("type") != "superadmin":
        raise HTTPException(403, "Superadmin only")
    return current_user


@router.post("")
def subscribe(
    data: SubscribeRequest,
    db: Session = Depends(get_db),
    _: None = rate_limit("public_forms"),
):
    """Public, unauthenticated -- ui/index.html's "Get notified when we
    ship something new" form. No auto-reply email; the UI's own inline
    "you're on the list" state is the confirmation."""
    SubscriberRepository.create(db, data.email)
    return success_response(message="You're on the list.")


@router.get("/admin")
def admin_list_subscribers(
    page: int = 1,
    per_page: int = 25,
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    paging = parse_paging(page, per_page)
    items, total = SubscriberRepository.list_paginated(db, paging["offset"], paging["limit"])
    return success_response(
        data=[SubscriberData.model_validate(s).model_dump(mode="json") for s in items],
        meta=build_meta(total, paging["page"], paging["per_page"]),
    )
