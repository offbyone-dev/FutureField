from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user, security
from app.schemas.analysis import SuitabilityRequest, SuitabilityResponse
from app.services import personal_suitability_service


router = APIRouter(tags=["personal-suitability"])


@router.post(
    "/personal/fields/{field_id}/suitability",
    response_model=SuitabilityResponse,
)
def get_personal_crop_suitability(
    field_id: str,
    body: SuitabilityRequest,
    user=Depends(get_current_user),
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ] = None,
):
    if body.simulation is not None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=422,
            detail="Simulation is not supported by this endpoint yet.",
        )

    return personal_suitability_service.run_personal_suitability(
        field_id=field_id,
        token=credentials.credentials,
        user_id=str(user.id),
        priorities=body.priorities,
    )