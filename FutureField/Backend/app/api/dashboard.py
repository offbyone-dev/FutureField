from fastapi import APIRouter, Query

from app.services import ui_service

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def get_dashboard(field_id: str | None = Query(default=None)):
    return ui_service.dashboard(field_id)


@router.get("/lookups")
def get_lookups():
    return ui_service.lookups()
