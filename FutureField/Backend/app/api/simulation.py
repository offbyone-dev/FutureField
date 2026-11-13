from fastapi import APIRouter

from app.schemas.analysis import SimulationRequest, SimulationResult
from app.services import simulation_service

router = APIRouter(tags=["simulation"])


@router.post("/fields/{field_id}/simulate", response_model=SimulationResult)
def simulate(field_id: str, body: SimulationRequest):
    return simulation_service.run_simulation(field_id, body)
