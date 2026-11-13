from datetime import datetime

from pydantic import BaseModel, Field


class EnvironmentalData(BaseModel):
    field_id: str
    dataset: str  # e.g. "nasa_power" or "mock"
    start: str
    end: str
    indicators: dict[str, float]  # raw-unit indicators (mm, degC, days...)
    normalized: dict[str, float]  # same keys scaled to 0 to 1
    monthly: dict[str, dict[str, float]] = Field(default_factory=dict)  # for charts
    daily: dict[str, list] = Field(default_factory=dict)  # dates + numeric series for UI charts
    quality_score: float  # 0 to 1
    source: str  # "real" | "mock" | "partial"
    sources: list[str] = Field(default_factory=list)
    fetched_at: datetime
