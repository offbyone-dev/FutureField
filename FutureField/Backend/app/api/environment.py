from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user, security
from app.schemas.environment import EnvironmentalData
from app.services import personal_environment_service

router = APIRouter(tags=["environment"])


@router.get(
    "/fields/{field_id}/environment",
    response_model=EnvironmentalData,
)
def get_environment(
    field_id: str,
    refresh: bool = Query(default=False),
    user=Depends(get_current_user),
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ] = None,
):
    return personal_environment_service.get_personal_environment(
        field_id=field_id,
        token=credentials.credentials,
        user_id=str(user.id),
        refresh=refresh,
    )