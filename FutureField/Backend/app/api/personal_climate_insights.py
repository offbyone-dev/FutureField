"""Authenticated field-specific Climate Insights API."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user, security
from app.services import personal_climate_insights_service


router = APIRouter(tags=["personal-climate-insights"])


@router.get("/personal/fields/{field_id}/climate-insights")
def get_personal_climate_insights(
    field_id: str,
    refresh: bool = False,
    user=Depends(get_current_user),
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ] = None,
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
        )

    return personal_climate_insights_service.get_personal_climate_insights(
        field_id=field_id,
        token=credentials.credentials,
        user_id=str(user.id),
        refresh=refresh,
    )