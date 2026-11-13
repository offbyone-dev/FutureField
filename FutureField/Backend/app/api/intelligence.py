from fastapi import APIRouter

from app.schemas.analysis import FieldCondition
from app.services import intelligence_service

router = APIRouter(tags=["intelligence"])


@router.get("/fields/{field_id}/intelligence", response_model=FieldCondition)
def get_intelligence(field_id: str):
    return intelligence_service.get_intelligence(field_id)
