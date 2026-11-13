"""FutureField — Personal Rotation Schemas.

Authenticated farmer-specific rotation planning.

Environmental observations are historical.
Rotation scores are heuristic estimates.
Season feasibility requires verified crop calendars.
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.analysis import (
    Priorities,
    RotationScore,
)


class PersonalRotationRequest(BaseModel):
    priorities: Priorities = Field(
        default_factory=Priorities
    )

    top_n: int = Field(
        default=6,
        ge=2,
        le=8,
    )

    n_slots: int = Field(
        default=3,
        ge=2,
        le=4,
    )

    limit: int = Field(
        default=5,
        ge=2,
        le=10,
    )


class RotationSeasonStatus(BaseModel):
    status: Literal[
        "compatible",
        "outside_planting_window",
        "not_assessed",
    ] = "not_assessed"

    reason: str
    verified: bool = False


class PlantingCalendarOption(BaseModel):
    season_id: str | None = None
    name: str | None = None
    planting_months: list[int] = Field(
        default_factory=list
    )
    source: str | None = None
    verified: bool = False


class RotationPlantingSlot(BaseModel):
    slot: int
    crop_id: str
    crop_name: str

    reported_season: str | None = None
    reported_year: int | None = None

    proposed_planting_month: int | None = None

    season_assessment: RotationSeasonStatus

    calendar_options: list[PlantingCalendarOption] = Field(
        default_factory=list
    )


class PersonalRotationStrategy(BaseModel):
    strategy_id: str

    strategy_type: Literal[
        "current",
        "alternative",
    ]

    title: str

    crop_ids: list[str]
    crop_names: list[str]

    slot_scores: list[float] = Field(
        default_factory=list
    )

    score: RotationScore | None = None

    total_water_demand_mm: float | None = None

    season_assessment: RotationSeasonStatus

    planting_schedule: list[RotationPlantingSlot] = Field(
        default_factory=list
    )

    benefits: list[str] = Field(
        default_factory=list
    )

    risks: list[str] = Field(
        default_factory=list
    )

    evidence: list[str] = Field(
        default_factory=list
    )

    limitations: list[str] = Field(
        default_factory=list
    )


class PersonalRotationResponse(BaseModel):
    field_id: str

    data_source: Literal["real"]

    simulated: bool = False

    data_quality: float

    current_rotation: PersonalRotationStrategy | None = None

    alternatives: list[PersonalRotationStrategy] = Field(
        default_factory=list
    )

    history_status: Literal[
        "available",
        "insufficient",
        "unavailable",
    ]

    history_message: str | None = None

    methodology: str = (
        "Explainable rule-based rotation assessment "
        "using historical NASA environmental observations, "
        "farmer soil information, crop characteristics, "
        "and farmer priorities."
    )

    limitations: list[str] = Field(
        default_factory=lambda: [
            (
                "Historical NASA observations are not "
                "future weather forecasts."
            ),
            (
                "Rotation scores are heuristic estimates, "
                "not validated yield predictions."
            ),
            (
                "Estimated crop water demand does not "
                "represent actual irrigation requirements."
            ),
            (
                "Soil-health scores do not predict measured "
                "changes in soil organic matter or nutrients."
            ),
            (
                "Rotation feasibility requires local "
                "agronomic and seasonal verification."
            ),
        ]
    )