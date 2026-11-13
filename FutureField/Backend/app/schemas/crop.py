from pydantic import BaseModel


class CropRequirements(BaseModel):
    id: str
    name: str
    family: str
    category: str
    seasons: list[str]
    temp_min: float
    temp_opt: float
    temp_max: float
    water_need_mm: float  # seasonal water need
    ph_min: float
    ph_max: float
    soil_textures: list[str]
    growth_days: int
    drought_tolerance: float  # 0..1
    flood_tolerance: float  # 0..1
    soil_effect: float  # -1..1 (legume > 0, heavy feeder < 0)
    yield_index: float  # 0..1 relative yield / market potential
    source_ref: str = "PLACEHOLDER - cite agronomic source"
