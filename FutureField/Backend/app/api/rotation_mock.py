from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services import ui_service

router = APIRouter(prefix="/api", tags=["rotations-mock"])


class RotationPriorities(BaseModel):
    water_saving: float = Field(40, ge=0, le=100)
    soil_health: float = Field(30, ge=0, le=100)
    climate_resilience: float = Field(20, ge=0, le=100)
    yield_productivity: float = Field(10, ge=0, le=100)


@router.get("/rotations-mock")
def get_rotations_mock(field_id: str | None = Query(default=None)):
    return ui_service.rotations(field_id)


@router.post("/rotations-mock/generate")
def generate_rotations(priorities: RotationPriorities, field_id: str | None = Query(default=None)):
    return ui_service.rotations(field_id, priorities.model_dump())
