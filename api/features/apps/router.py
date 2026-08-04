from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from utils.helpers import success_response, error_response
from features.apps.schemas import AppData
from features.apps.repository import AppRepository


router = APIRouter(prefix="/apps", tags=["apps"])


@router.get("")
def list_apps(db: Session = Depends(get_db)):
    apps = AppRepository.list_public(db)
    return success_response(
        data=[AppData.model_validate(a).model_dump(mode="json") for a in apps]
    )


@router.get("/{slug}")
def get_app(slug: str, db: Session = Depends(get_db)):
    app = AppRepository.get_by_slug(db, slug)
    if not app or not app.is_active or not app.is_public:
        return error_response("APP_NOT_FOUND", "App not found", 404)
    return success_response(data=AppData.model_validate(app).model_dump(mode="json"))
