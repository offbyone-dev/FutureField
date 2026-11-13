from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services import ui_service

router = APIRouter(prefix="/api", tags=["scenario-lab"])


class ScenarioParams(BaseModel):
    rainfall_pct: int = Field(0)
    temperature_delta: int = Field(0)
    water_availability: str = Field("Medium")
    soil_recovery: str = Field("Medium")


@router.get("/scenario-lab")
def get_scenario_lab(field_id: str | None = Query(default=None)):
    return ui_service.scenario_lab(field_id)


@router.post("/scenario-lab/simulate")
def simulate_scenario(params: ScenarioParams, field_id: str | None = Query(default=None)):
    return ui_service.scenario_lab(field_id, params.model_dump())
