from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

from app.services import ui_service

router = APIRouter(prefix="/api", tags=["season-outcomes"])


class SeasonOutcomeRequest(BaseModel):
    field: str | None = None
    field_id: str | None = None
    season: str | None = None
    crop_planted: str = ""
    actual_yield_t_ha: Optional[float] = None
    water_used: str = "As expected"
    weather_event: str = "None"
    match_experience: str = ""
    farmer_note: str = ""


@router.post("/season-outcomes")
def submit_season_outcome(body: SeasonOutcomeRequest, field_id: str | None = Query(default=None)):
    payload = body.model_dump()
    payload["field_id"] = field_id or body.field_id or body.field
    return ui_service.save_outcome(payload)


@router.get("/season-outcomes")
def get_season_outcomes(field_id: str | None = Query(default=None)):
    return ui_service.list_outcomes(field_id)
