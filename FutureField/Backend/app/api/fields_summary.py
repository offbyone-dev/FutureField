from fastapi import APIRouter

from app.services import ui_service

router = APIRouter(prefix="/api", tags=["fields-summary"])


@router.get("/fields-summary")
def get_fields_summary():
    return ui_service.fields_summary()
