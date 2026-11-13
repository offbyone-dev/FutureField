from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# --------------------------------------------------
# Soil Information
# --------------------------------------------------

class SoilInfo(BaseModel):
    texture: str = "loam"
    ph: float = 6.5
    organic_matter: float = 2.0
    drainage: str = "moderate"
    source: str = "farmer"
    confidence: float = 0.7


# --------------------------------------------------
# Crop History
# --------------------------------------------------

class CropHistoryItem(BaseModel):
    crop_id: str

    # Kept for compatibility with previously saved records
    season: str = ""

    year: int

    # Actual cultivation period (1 = January, 12 = December)
    start_month: int | None = Field(
        default=None,
        ge=1,
        le=12,
    )

    end_month: int | None = Field(
        default=None,
        ge=1,
        le=12,
    )

    # Optional actual yield in tonnes per hectare
    yield_t_ha: float | None = Field(
        default=None,
        ge=0,
    )


# --------------------------------------------------
# Field Creation / Update
# --------------------------------------------------

class FieldCreate(BaseModel):
    name: str
    boundary: dict

    irrigation_type: Literal[
        "rainfed",
        "supplemental",
        "irrigated",
    ] = "rainfed"

    water_source: str = "rain"

    soil: SoilInfo = Field(default_factory=SoilInfo)

    crop_history: list[CropHistoryItem] = Field(
        default_factory=list
    )

    division: str = ""
    district: str = ""

    current_crop: str = ""

    # Retained for compatibility with existing fields
    previous_crops: list[str] = Field(
        default_factory=list
    )

    # Retained for compatibility with previously saved rotations
    existing_rotation: list[str] = Field(
        default_factory=list
    )


# --------------------------------------------------
# Field Response
# --------------------------------------------------

class FieldOut(FieldCreate):
    id: str
    centroid_lat: float
    centroid_lon: float
    area_ha: float
    created_at: datetime