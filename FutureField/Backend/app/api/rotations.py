from fastapi import APIRouter

from app.schemas.analysis import RotationRequest, RotationResponse
from app.services import rotation_service

router = APIRouter(tags=["rotations"])


@router.post("/fields/{field_id}/rotations", response_model=RotationResponse)
def run_rotations(field_id: str, body: RotationRequest):
    return rotation_service.run_rotations(field_id, body)
