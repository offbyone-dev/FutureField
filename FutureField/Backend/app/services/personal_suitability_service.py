"""
Personal-field crop suitability using NASA environmental observations.

- Requires an authenticated Supabase-owned field.
- Does not invent irrigation quantities.
- Does not score incomplete rainfall or temperature windows.
- Results are heuristic suitability estimates, not NASA predictions.
- Planting calendar assessments are independent of suitability scores.
"""

import math
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.engines import suitability
from app.engines.season_calendar import check_crop_season
from app.knowledge.loader import load_crops
from app.processing.indicators import compute_indicators
from app.schemas.analysis import (
    FieldCondition,
    Priorities,
    SeasonAssessment,
    SuitabilityResponse,
)
from app.services import (
    personal_environment_service,
    supabase_field_service,
)

MIN_COVERAGE = 0.95
BANGLADESH_TZ = ZoneInfo("Asia/Dhaka")


def _valid(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _crop_window(daily: dict, growth_days: int):
    """Recent historical observations, not a future-season forecast."""
    dates = daily.get("dates", [])
    if len(dates) < growth_days:
        return None

    result = {"dates": dates[-growth_days:]}
    for key, values in daily.items():
        if key == "dates":
            continue
        if isinstance(values, list):
            if len(values) != len(dates):
                return None
            result[key] = values[-growth_days:]
    return result


def _make_condition(field, indicators, coverage):
    """Use observed rainfall only; no assumed irrigation is added."""
    rain = indicators["rain_total_mm"]
    mean_temp = indicators["mean_temp_c"]
    soil = field.soil
    confidence = min(coverage, float(soil.confidence))

    flags = []
    if indicators["dry_spell_max_days"] >= 10:
        flags.append("drought_risk")
    if indicators["heat_stress_days"] >= 10:
        flags.append("heat_stress")
    if indicators.get("rain_std_monthly", 0) > 250:
        flags.append("high_rainfall_variability")
    if confidence < 0.5:
        flags.append("low_data_confidence")

    return FieldCondition(
        mean_temp_c=mean_temp,
        rain_total_mm=rain,
        water_supply_mm=rain,
        dry_spell_max_days=indicators["dry_spell_max_days"],
        season_days=indicators["season_days"],
        soil=soil,
        soil_fertility_adj=0.0,
        water_score=0.5,
        heat_score=0.5,
        soil_score=0.5,
        vegetation_score=0.5,
        flags=flags,
        confidence=round(confidence, 3),
    )


def run_personal_suitability(
    field_id: str,
    token: str,
    user_id: str,
    priorities: Priorities,
) -> SuitabilityResponse:
    # Field ownership is checked by the Supabase field service.
    field = supabase_field_service.get_field(
        field_id=field_id,
        token=token,
        user_id=user_id,
    )
    env = personal_environment_service.get_personal_environment(
        field_id=field_id,
        token=token,
        user_id=user_id,
        refresh=False,
    )
    if env.source != "real":
        raise HTTPException(
            status_code=422,
            detail=(
                "Real NASA environmental data is required "
                "for personal crop suitability."
            ),
        )

    daily = env.daily
    crops = load_crops()
    results = []
    assessment_month = datetime.now(BANGLADESH_TZ).month

    for crop in crops:
        window = _crop_window(daily, crop.growth_days)
        if window is None:
            continue

        indicators = compute_indicators(window)
        rain_coverage = indicators.get("rain_coverage_pct", 0) / 100
        temp_coverage = indicators.get("temperature_coverage_pct", 0) / 100
        coverage = min(rain_coverage, temp_coverage)
        if coverage < MIN_COVERAGE:
            continue
        if (
            not _valid(indicators["mean_temp_c"])
            or not _valid(indicators["rain_total_mm"])
        ):
            continue

        condition = _make_condition(
            field=field,
            indicators=indicators,
            coverage=coverage,
        )
        result = suitability.score_crop(condition, crop, priorities)

        # Calendar data is provisional until independently verified.
        # This metadata must not alter total_score or recommended.
        season_data = check_crop_season(
            crop_id=crop.id,
            month=assessment_month,
        )
        season_assessment = SeasonAssessment(
            month=season_data["month"],
            compatible=season_data["compatible"],
            status=season_data["status"],
            reason=season_data["reason"],
            matching_seasons=season_data.get("matching_seasons", []),
        )
        result = result.model_copy(
            update={"season_assessment": season_assessment}
        )
        results.append(result)

    if not results:
        raise HTTPException(
            status_code=422,
            detail=(
                "Insufficient NASA observations for crop "
                "suitability calculation."
            ),
        )

    results.sort(
        key=lambda r: (
            not r.recommended,
            -r.total_score,
        )
    )

    return SuitabilityResponse(
        field_id=field_id,
        results=results,
        data_quality=env.quality_score,
        data_source=env.source,
        simulated=False,
    )
