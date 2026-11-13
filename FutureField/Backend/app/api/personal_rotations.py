"""
Authenticated personal rotation planning API.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user, security
from app.schemas.personal_rotation import (
    PersonalRotationRequest,
    PersonalRotationResponse,
)
from app.services import personal_rotation_service


router = APIRouter(tags=["personal-rotations"])


@router.post(
    "/personal/fields/{field_id}/rotations",
    response_model=PersonalRotationResponse,
)
def get_personal_rotations(
    field_id: str,
    body: PersonalRotationRequest,
    user=Depends(get_current_user),
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ] = None,
):
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
        )

    return personal_rotation_service.run_personal_rotations(
        field_id=field_id,
        token=credentials.credentials,
        user_id=str(user.id),
        priorities=body.priorities,
        top_n=body.top_n,
        n_slots=body.n_slots,
        limit=body.limit,
    )