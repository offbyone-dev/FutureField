from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.field import SoilInfo


class Priorities(BaseModel):
    """Farmer priorities, each 0..1. They change weights, not fit scores."""

    water: float = Field(0.5, ge=0, le=1)
    yield_potential: float = Field(0.5, ge=0, le=1)
    soil_health: float = Field(0.5, ge=0, le=1)
    risk: float = Field(0.5, ge=0, le=1)


class SimulationParams(BaseModel):
    rainfall_pct: float = Field(0.0, ge=-100, le=200)
    temperature_delta_c: float = Field(0.0, ge=-10, le=10)
    water_availability_pct: float = Field(0.0, ge=-100, le=200)


class FieldCondition(BaseModel):
    """Derived field conditions consumed by the scoring engines."""

    mean_temp_c: float
    rain_total_mm: float
    water_supply_mm: float
    dry_spell_max_days: float
    season_days: float
    soil: SoilInfo
    soil_fertility_adj: float = 0.0
    water_score: float
    heat_score: float
    soil_score: float
    vegetation_score: float
    flags: list[str] = Field(default_factory=list)
    confidence: float


class ExplanationItem(BaseModel):
    component: str
    impact: float
    direction: Literal["positive", "negative"]
    text: str


class SeasonMatch(BaseModel):
    season_id: str | None = None
    name: str | None = None
    source: str | None = None


class SeasonAssessment(BaseModel):
    """Calendar-only assessment; independent of NASA suitability scores."""

    month: int = Field(ge=1, le=12)
    compatible: bool | None = None
    status: Literal["compatible", "outside_planting_window", "not_assessed"]
    reason: str
    matching_seasons: list[SeasonMatch] = Field(default_factory=list)


class SuitabilityResult(BaseModel):
    crop_id: str
    crop_name: str
    total_score: float
    components: dict[str, float]
    weights: dict[str, float]
    recommended: bool = True
    not_recommended_reason: str | None = None
    explanation: list[ExplanationItem] = Field(default_factory=list)
    # Optional so existing scoring/rotation/simulation callers remain compatible.
    season_assessment: SeasonAssessment | None = None


class SuitabilityRequest(BaseModel):
    priorities: Priorities = Field(default_factory=Priorities)
    simulation: SimulationParams | None = None


class SuitabilityResponse(BaseModel):
    field_id: str
    results: list[SuitabilityResult]
    data_quality: float
    data_source: str
    simulated: bool = False


class RotationScore(BaseModel):
    total: float
    suitability: float
    water_impact: float
    soil_impact: float
    resilience: float
    yield_score: float
    explanation: list[ExplanationItem] = Field(default_factory=list)


class RotationScenario(BaseModel):
    crop_ids: list[str]
    crop_names: list[str]
    slot_scores: list[float]
    score: RotationScore


class RotationRequest(BaseModel):
    priorities: Priorities = Field(default_factory=Priorities)
    simulation: SimulationParams | None = None
    top_n: int = Field(4, ge=2, le=10)
    n_slots: int = Field(3, ge=2, le=4)
    limit: int = Field(5, ge=1, le=50)


class RotationResponse(BaseModel):
    field_id: str
    rotations: list[RotationScenario]
    data_quality: float
    data_source: str
    simulated: bool = False


class SimulationRequest(BaseModel):
    params: SimulationParams
    priorities: Priorities = Field(default_factory=Priorities)
    include_rotations: bool = True


class CropDelta(BaseModel):
    crop_id: str
    crop_name: str
    baseline_score: float
    simulated_score: float
    score_delta: float
    baseline_rank: int
    simulated_rank: int
    rank_change: int
    new_risk: str | None = None


class SimulationResult(BaseModel):
    field_id: str
    params: SimulationParams
    baseline: list[SuitabilityResult]
    simulated: list[SuitabilityResult]
    crop_deltas: list[CropDelta]
    baseline_rotations: list[RotationScenario] = Field(default_factory=list)
    simulated_rotations: list[RotationScenario] = Field(default_factory=list)
    top_rotation_changed: bool = False
    limitation: str
