from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.analysis import RotationScenario, SimulationParams


class CalendarEntry(BaseModel):
    slot: int
    crop_id: str
    crop_name: str
    sowing_start: date
    sowing_end: date
    harvest_start: date
    harvest_end: date
    key_actions: list[str] = Field(default_factory=list)


class PlanRequest(BaseModel):
    rotation: RotationScenario  # the rotation the user chose in the UI
    start_date: date | None = None
    scenario_used: SimulationParams | None = None


class FarmPlan(BaseModel):
    id: str
    field_id: str
    rotation: RotationScenario
    calendar: list[CalendarEntry]
    assumptions: list[str]
    scenario_used: SimulationParams | None = None
    created_at: datetime


class OutcomeCreate(BaseModel):
    actual_crops: list[str]  # crop ids actually grown, per slot
    actual_yield_t_ha: float | None = None
    issues: list[str] = Field(default_factory=list)
    notes: str = ""


class SeasonOutcome(OutcomeCreate):
    plan_id: str
    comparison: dict  # filled by engines/outcome.py
    saved_at: datetime
