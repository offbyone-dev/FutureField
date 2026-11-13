"""Seasonal decision report API."""

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)

from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user, security

from app.services import (
    ui_service,
    personal_reports_service,
)


router = APIRouter(tags=["reports"])


# --------------------------------------------------
# Existing report endpoints
# --------------------------------------------------

@router.get("/api/report")
def get_report(
    field_id: str | None = Query(default=None),
):
    return ui_service.report(field_id)


@router.get("/api/report/{field_name}")
def get_report_by_field(
    field_name: str,
):
    return ui_service.report(field_name)


# --------------------------------------------------
# Authenticated personal report
# --------------------------------------------------

@router.get(
    "/personal/fields/{field_id}/report",
)
def get_personal_report(
    field_id: str,

    refresh: bool = Query(default=False),

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

    return personal_reports_service.get_personal_report(
        field_id=field_id,
        token=credentials.credentials,
        user_id=str(user.id),
        refresh=refresh,
    )