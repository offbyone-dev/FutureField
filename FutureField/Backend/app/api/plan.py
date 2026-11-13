from fastapi import APIRouter

from app.schemas.plan import FarmPlan, OutcomeCreate, PlanRequest, SeasonOutcome
from app.services import outcome_service, plan_service
from app.storage import json_store

router = APIRouter(tags=["plan"])


@router.post("/fields/{field_id}/plan", response_model=FarmPlan, status_code=201)
def build_plan(field_id: str, body: PlanRequest):
    return plan_service.build_plan(field_id, body)


@router.get("/plans/{plan_id}", response_model=FarmPlan)
def get_plan(plan_id: str):
    return plan_service.get_plan(plan_id)


@router.post("/plans/{plan_id}/outcome", response_model=SeasonOutcome, status_code=201)
def save_outcome(plan_id: str, body: OutcomeCreate):
    return outcome_service.save_outcome(plan_id, body)


@router.get("/plans/{plan_id}/outcome", response_model=SeasonOutcome)
def get_outcome(plan_id: str):
    """Retrieve a previously saved season outcome for a plan."""
    from app.errors import NotFoundError
    raw = json_store.load("outcomes", plan_id)
    if raw is None:
        raise NotFoundError(f"No outcome found for plan '{plan_id}'")
    return SeasonOutcome(**raw)
