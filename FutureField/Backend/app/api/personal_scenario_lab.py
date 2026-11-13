"""
FutureField — Authenticated Personal Scenario Lab API.

Supports:
- Custom rainfall changes (-100% to +100%)
- Custom temperature changes (-10°C to +10°C)
- Custom water availability (0% to 150%)
- Custom soil recovery priority (0% to 100%)
- Existing Low / Medium / High presets
- Supabase authentication
- Field-specific scenario simulations
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from pydantic import BaseModel, Field, ConfigDict

from app.auth import get_current_user, security
from app.services import personal_scenario_service


# ==================================================
# ROUTER CONFIGURATION
# ==================================================

router = APIRouter(
    prefix="/personal/fields",
    tags=["personal-scenario-lab"],
)


# ==================================================
# SCENARIO REQUEST PARAMETERS
# ==================================================

class PersonalScenarioParams(BaseModel):

    model_config = ConfigDict(
        extra="forbid"
    )

    # Rainfall change: -100% to +100%
    rainfall_pct: float = Field(
        default=0,
        ge=-100,
        le=100,
        description="Hypothetical rainfall percentage change."
    )

    # Temperature change: -10°C to +10°C
    temperature_delta: float = Field(
        default=0,
        ge=-10,
        le=10,
        description="Hypothetical temperature change in Celsius."
    )

    # Water availability:
    # Preset: Low / Medium / High
    # Custom: 0% to 150%
    water_availability: (
        Literal["Low", "Medium", "High"]
        | float
    ) = Field(
        default="Medium",
        description=(
            "Water availability preset or custom percentage "
            "between 0 and 150."
        )
    )

    # Soil recovery priority:
    # Preset: Low / Medium / High
    # Custom: 0% to 100%
    soil_recovery: (
        Literal["Low", "Medium", "High"]
        | float
    ) = Field(
        default="Medium",
        description=(
            "Soil health scoring priority preset or "
            "custom percentage between 0 and 100."
        )
    )


# ==================================================
# AUTHENTICATION TOKEN HELPER
# ==================================================

def _token(
    credentials: HTTPAuthorizationCredentials | None
) -> str:

    if (
        credentials is None
        or not credentials.credentials
    ):
        raise HTTPException(
            status_code=401,
            detail="Authentication required."
        )

    return credentials.credentials


# ==================================================
# GET — DEFAULT PERSONAL SCENARIO
# ==================================================

@router.get("/{field_id}/scenario-lab")
def get_personal_scenario(
    field_id: str,

    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security)
    ],

    user=Depends(get_current_user),
):

    return personal_scenario_service.run_personal_scenario(
        field_id=field_id,
        token=_token(credentials),
        user_id=str(user.id),
    )


# ==================================================
# POST — CUSTOM PERSONAL SCENARIO SIMULATION
# ==================================================

@router.post("/{field_id}/scenario-lab/simulate")
def simulate_personal_scenario(
    field_id: str,

    body: PersonalScenarioParams,

    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security)
    ],

    user=Depends(get_current_user),
):

    return personal_scenario_service.run_personal_scenario(
        field_id=field_id,
        token=_token(credentials),
        user_id=str(user.id),
        params=body.model_dump(),
    )