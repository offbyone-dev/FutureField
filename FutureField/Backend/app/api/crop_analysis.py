from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field

from app.services import ui_service

router = APIRouter(prefix="/api", tags=["crop-analysis"])


class PrioritiesInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")
    water: float = 50
    drought: float = 50
    heat: float = 50
    yield_: float = Field(50, alias="yield")
    profit: float = 50
    soil: float = 50
    weather: float = 50
    diversity: float = 50


@router.get("/crop-suitability")
def get_crop_suitability(field_id: str | None = Query(default=None)):
    return ui_service.crop_suitability(field_id)


@router.post("/crop-suitability/score")
def score_crops(priorities: PrioritiesInput, field_id: str | None = Query(default=None)):
    return ui_service.crop_suitability(field_id, priorities.model_dump())
