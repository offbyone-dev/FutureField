"""indicators + farm info -> FieldCondition (profile + flags). Pure logic."""
from app.engines.scoring import clamp01
from app.schemas.analysis import FieldCondition
from app.schemas.field import FieldOut

IRRIGATION_MM = {"rainfed": 0.0, "supplemental": 150.0, "irrigated": 400.0}

# Thresholds — adjust when real validation data becomes available
DROUGHT_DRY_SPELL_DAYS = 10      # consecutive dry days -> drought_risk
DROUGHT_WATER_SCORE = 0.3        # water_score below this -> drought_risk
HEAT_STRESS_DAYS = 10            # >= this many Tmax>35°C days -> heat_stress
FLOOD_RAIN_MM = 800.0            # seasonal total -> flood_risk
HIGH_VARIABILITY_STD = 250.0     # monthly rain std dev -> high_rainfall_variability
HIGH_ET_DAY = 7.0                # mm/day ET -> high_et_demand
LOW_CONFIDENCE = 0.5             # confidence below this -> low_data_confidence
TARGET_PH = 6.5                  # neutral-ish reference for pH scoring


def detect_flags(ind: dict[str, float], water_score: float, confidence: float) -> list[str]:
    """Rule-based field flags from environmental indicators.

    drought_risk   – dry_spell >= 10 days (FAO I&D Paper 56) or water_score < 0.3.
    heat_stress    – >= 10 days with Tmax > 35°C (generic cereal stress threshold).
    flood_risk     – seasonal rainfall >= 800 mm.
    high_rainfall_variability – monthly rain std dev > 250 mm.
    high_et_demand – daily ET estimate > 7 mm/day.
    low_data_confidence – composite confidence below 0.5.
    """
    flags: list[str] = []
    if ind.get("dry_spell_max_days", 0) >= DROUGHT_DRY_SPELL_DAYS or water_score < DROUGHT_WATER_SCORE:
        flags.append("drought_risk")
    if ind.get("heat_stress_days", 0) >= HEAT_STRESS_DAYS:
        flags.append("heat_stress")
    if ind.get("rain_total_mm", 0) >= FLOOD_RAIN_MM:
        flags.append("flood_risk")
    if ind.get("rain_std_monthly", 0) > HIGH_VARIABILITY_STD:
        flags.append("high_rainfall_variability")
    if ind.get("et_mm_per_day", 0) > HIGH_ET_DAY:
        flags.append("high_et_demand")
    if confidence < LOW_CONFIDENCE:
        flags.append("low_data_confidence")
    return flags


def build_field_condition(
    field: FieldOut,
    indicators: dict[str, float],
    normalized: dict[str, float],
    quality: float,
    irrigation_scale: float = 1.0,
) -> FieldCondition:
    """Build a FieldCondition from environmental indicators and field metadata.

    water_score:
        Weighted combination of normalized rainfall (70%) and inverse of dry-spell
        fraction (30%). Range 0..1. Higher = more adequate water supply.

    heat_score:
        1 minus normalized heat-stress day fraction. Higher = lower heat stress.

    soil_score:
        pH proximity to 6.5 neutral (50%), organic matter bonus (up to 20%),
        optional soil-moisture bonus from SMAP (up to 5% when SM is in 20-50% range).

    vegetation_score:
        Maps NDVI trend slope. Flat = 0.5; improving = towards 1; declining = towards 0.

    confidence:
        Geometric mean of NASA data quality and farmer soil-info confidence.

    Limitations:
        - Soil score ignores drainage class and texture (handled in suitability fit).
        - ET and soil moisture affect flags only; they do not yet modify water_score
          directly (planned when OpenET data is integrated).
    """
    irr_mm = IRRIGATION_MM.get(field.irrigation_type, 0.0) * irrigation_scale
    supply = indicators["rain_total_mm"] + irr_mm

    # Water: rain adequacy + absence of long dry spells
    water_score = clamp01(
        0.7 * normalized["rain_total_mm"]
        + 0.3 * (1.0 - normalized.get("dry_spell_max_days", 0.0))
    )

    # Heat: penalise heat-stress days
    heat_score = clamp01(1.0 - normalized.get("heat_stress_days", 0.0))

    # Soil: pH optimality + organic matter + optional SMAP soil moisture bonus
    ph_penalty = abs(field.soil.ph - TARGET_PH) / 3.0     # 0 at pH 6.5, 1 at ±3
    om_bonus = min(field.soil.organic_matter, 4.0) / 20.0  # up to 0.20
    sm_bonus = 0.0
    if "soil_moisture_pct" in indicators:
        sm = indicators["soil_moisture_pct"]
        # Bonus when soil moisture is in the 20-50% range (adequate, not waterlogged)
        sm_bonus = 0.05 * clamp01((sm - 10.0) / 30.0) if sm >= 10.0 else 0.0
    soil_score = clamp01(1.0 - ph_penalty + om_bonus + sm_bonus)

    # Vegetation: NDVI trend slope mapped around 0.5
    vegetation_score = clamp01(normalized.get("ndvi_trend", 0.5))

    # Confidence: geometric mean of data quality and farmer soil confidence
    confidence = clamp01(quality * field.soil.confidence ** 0.5)

    flags = detect_flags(indicators, water_score, confidence)

    return FieldCondition(
        mean_temp_c=indicators["mean_temp_c"],
        rain_total_mm=indicators["rain_total_mm"],
        water_supply_mm=supply,
        dry_spell_max_days=indicators["dry_spell_max_days"],
        season_days=indicators["season_days"],
        soil=field.soil,
        water_score=round(water_score, 4),
        heat_score=round(heat_score, 4),
        soil_score=round(soil_score, 4),
        vegetation_score=round(vegetation_score, 4),
        flags=flags,
        confidence=round(confidence, 3),
    )
