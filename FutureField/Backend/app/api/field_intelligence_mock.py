
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
    personal_field_metrics_service,
    supabase_field_service,
)


router = APIRouter(tags=["field-intelligence"])


@router.get("/api/field-intelligence")
def get_field_intelligence(
    field_id: str | None = Query(default=None),
):
    return ui_service.field_intelligence(field_id)


@router.get("/api/field-intelligence/{field_name}")
def get_field_intelligence_named(
    field_name: str,
):
    return ui_service.field_intelligence(field_name)


# --------------------------------------------------
# Authenticated Personal Field Intelligence
# --------------------------------------------------

@router.get(
    "/personal/fields/{field_id}/intelligence"
)
def get_personal_field_intelligence(
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

    token = credentials.credentials
    user_id = str(user.id)

    # Verify authenticated field ownership.
    field = supabase_field_service.get_field(
        field_id=field_id,
        token=token,
        user_id=user_id,
    )

    # Same NASA metrics used by Reports.
    metrics = (
        personal_field_metrics_service
        .get_personal_field_metrics(
            field_id=field_id,
            token=token,
            user_id=user_id,
            refresh=refresh,
        )
    )

    return {
        "field_id": field_id,
        "field_name": (
            field.get("name", "Unnamed Field")
            if isinstance(field, dict)
            else getattr(field, "name", "Unnamed Field")
        ),
        "metrics": metrics,
    }