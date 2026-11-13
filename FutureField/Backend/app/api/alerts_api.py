"""
FutureField — Authenticated Personal Alerts API.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user, security
from app.services import personal_alerts_service


router = APIRouter(
    prefix="/api",
    tags=["alerts"],
)


def get_auth_context(
    user=Depends(get_current_user),
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ] = None,
):
    return {
        "user_id": str(user.id),
        "token": credentials.credentials,
    }


@router.get("/alerts")
def get_alerts(
    field_id: str | None = Query(default=None),
    auth=Depends(get_auth_context),
):
    return personal_alerts_service.get_personal_alerts(
        token=auth["token"],
        user_id=auth["user_id"],
        field_id=field_id,
    )