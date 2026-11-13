from fastapi import APIRouter

from app.knowledge.loader import load_crops
from app.schemas.analysis import SuitabilityRequest, SuitabilityResponse
from app.schemas.crop import CropRequirements
from app.services import suitability_service

router = APIRouter(tags=["suitability"])


@router.post("/fields/{field_id}/suitability", response_model=SuitabilityResponse)
def run_suitability(field_id: str, body: SuitabilityRequest):
    return suitability_service.run_suitability(field_id, body)


@router.get("/crops", response_model=list[CropRequirements])
def list_crops():
    return load_crops()
