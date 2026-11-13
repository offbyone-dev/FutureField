from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

from app.services import ui_service
from app.storage import json_store

router = APIRouter(prefix="/api", tags=["feedback"])


class FeedbackRequest(BaseModel):
    field: str | None = None
    field_id: str | None = None
    crop: str = ""
    helpful: Optional[bool] = None
    reason: str = ""
    note: str = ""


@router.post("/feedback")
def submit_feedback(body: FeedbackRequest, field_id: str | None = Query(default=None)):
    payload = body.model_dump()
    payload["field_id"] = field_id or body.field_id or body.field
    return ui_service.save_feedback(payload)


@router.get("/feedback")
def get_feedback():
    rows = json_store.list_all("feedback")
    return {"feedback": rows, "count": len(rows)}
