"""
FutureField personal scenario analysis.

Real NASA observations are used as a historical baseline.
All changes are hypothetical, heuristic comparisons,
not NASA predictions or irrigation estimates.
"""

from __future__ import annotations

import math
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.engines import suitability
from app.engines.personal_rotation_scoring import score_personal_rotation
from app.knowledge.loader import load_crops
from app.processing.indicators import compute_indicators
from app.schemas.analysis import Priorities

from app.services import (
    personal_environment_service,
    personal_rotation_service,
    personal_suitability_service,
    supabase_field_service,
)


# ==================================================
# PARAMETER PRESETS
# ==================================================

WATER_PRESETS = {
    "Low": 70.0,
    "Medium": 100.0,
    "High": 110.0,
}

SOIL_PRESETS = {
    "Low": 15.0,
    "Medium": 35.0,
    "High": 65.0,
}


# ==================================================
# PARAMETER VALIDATION
# ==================================================

def _number(value, name, minimum, maximum):

    if isinstance(value, bool):
        raise HTTPException(
            422,
            f"{name} must be a number."
        )

    try:
        number = float(value)

    except (TypeError, ValueError):
        raise HTTPException(
            422,
            f"{name} must be a number."
        ) from None

    if not math.isfinite(number) or not minimum <= number <= maximum:
        raise HTTPException(
            422,
            f"{name} must be between {minimum} and {maximum}."
        )

    return number


def _level(value, name, presets, maximum):

    if isinstance(value, str) and value in presets:
        return value, presets[value]

    number = _number(
        value,
        name,
        0,
        maximum
    )

    return "Custom", number


def _validate(params):

    p = params or {}

    if not isinstance(p, dict):
        raise HTTPException(
            422,
            "Scenario parameters must be an object."
        )

    rain = _number(
        p.get("rainfall_pct", 0),
        "rainfall_pct",
        -100,
        100
    )

    temp = _number(
        p.get("temperature_delta", 0),
        "temperature_delta",
        -10,
        10
    )

    water_label, water_pct = _level(
        p.get("water_availability", "Medium"),
        "water_availability",
        WATER_PRESETS,
        150
    )

    soil_label, soil_pct = _level(
        p.get("soil_recovery", "Medium"),
        "soil_recovery",
        SOIL_PRESETS,
        100
    )

    return (
        rain,
        temp,
        water_label,
        water_pct,
        soil_label,
        soil_pct
    )


# ==================================================
# NUMERIC VALIDATION
# ==================================================

def _valid(value):

    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


# ==================================================
# MODIFY HISTORICAL OBSERVATIONS
# ==================================================

def _change_window(
    window,
    rainfall_factor,
    temperature_delta
):

    changed = {
        key: list(value) if isinstance(value, list) else value
        for key, value in window.items()
    }

    adjustments = [
        ("rain", rainfall_factor, 0),
        ("tmax", 1, temperature_delta),
        ("tmin", 1, temperature_delta),
    ]

    for key, factor, offset in adjustments:

        if key not in changed:
            continue

        changed[key] = [
            value * factor + offset
            if _valid(value)
            else value
            for value in changed[key]
        ]

    return changed


# ==================================================
# SCENARIO CROP SUITABILITY
# ==================================================

def _scenario_suitability(
    field,
    env,
    priorities,
    rainfall_factor,
    temp_delta,
    water_factor
):

    results = {}

    for crop in load_crops():

        window = personal_suitability_service._crop_window(
            env.daily,
            crop.growth_days
        )

        if window is None:
            continue

        observed = compute_indicators(window)

        coverage = min(
            observed.get("rain_coverage_pct", 0),
            observed.get("temperature_coverage_pct", 0),
        ) / 100

        if coverage < personal_suitability_service.MIN_COVERAGE:
            continue

        # Hypothetical effective-rainfall proxy.
        # NOT measured irrigation or a physical water-balance model.

        changed_window = _change_window(
            window,
            rainfall_factor * water_factor,
            temp_delta
        )

        changed = compute_indicators(changed_window)

        changed_coverage = min(
            changed.get("rain_coverage_pct", 0),
            changed.get("temperature_coverage_pct", 0),
        ) / 100

        if changed_coverage < personal_suitability_service.MIN_COVERAGE:
            continue

        if not all(
            _valid(changed.get(key))
            for key in (
                "rain_total_mm",
                "mean_temp_c"
            )
        ):
            continue

        condition = personal_suitability_service._make_condition(
            field,
            changed,
            changed_coverage
        )

        results[crop.id] = suitability.score_crop(
            condition,
            crop,
            priorities
        )

    return results


# ==================================================
# OBSERVED NASA BASELINE SUMMARY
# ==================================================

def _observed_summary(daily):

    dates = daily.get("dates", [])

    rain = daily.get("rain", [])

    high = daily.get("tmax", [])

    low = daily.get("tmin", [])

    if not dates or any(
        len(series) != len(dates)
        for series in (rain, high, low)
    ):
        raise HTTPException(
            503,
            "NASA rainfall/temperature series are incomplete."
        )

    valid_rain = [
        value
        for value in rain
        if _valid(value) and 0 <= value <= 500
    ]

    valid_temp = [
        (hi + lo) / 2
        for hi, lo in zip(high, low)
        if (
            _valid(hi)
            and _valid(lo)
            and hi >= lo
            and -80 <= lo <= 55
            and -60 <= hi <= 65
        )
    ]

    threshold = personal_suitability_service.MIN_COVERAGE

    if (
        len(valid_rain) / len(dates) < threshold
        or len(valid_temp) / len(dates) < threshold
    ):
        raise HTTPException(
            503,
            "Insufficient observed rainfall/temperature coverage."
        )

    wetness = [
        value
        for value in daily.get("soil_moisture", [])
        if _valid(value) and 0 <= value <= 1
    ]

    return (
        sum(valid_rain),
        sum(valid_temp) / len(valid_temp),
        wetness[-1] if wetness else None
    )


# ==================================================
# MAIN PERSONAL SCENARIO SERVICE
# ==================================================

def run_personal_scenario(
    field_id: str,
    token: str,
    user_id: str,
    params: dict | None = None
):

    # ----------------------------------------------
    # 1. Validate custom parameters
    # ----------------------------------------------

    (
        rain_change,
        temp_change,
        water_label,
        water_pct,
        soil_label,
        soil_pct
    ) = _validate(params)

    # ----------------------------------------------
    # 2. Verify Supabase field ownership
    # ----------------------------------------------

    field = supabase_field_service.get_field(
        field_id=field_id,
        token=token,
        user_id=user_id
    )

    # ----------------------------------------------
    # 3. Fetch real NASA observations
    # ----------------------------------------------

    env = personal_environment_service.get_personal_environment(
        field_id=field_id,
        token=token,
        user_id=user_id
    )

    if env.source != "real":
        raise HTTPException(
            503,
            "Verified real NASA baseline unavailable; "
            "mock/partial data rejected."
        )

    rain_mm, mean_temp, wetness = _observed_summary(
        env.daily or {}
    )

    # ----------------------------------------------
    # 4. Configure custom soil priority
    # ----------------------------------------------

    soil_weight = soil_pct / 100

    priorities = Priorities(
        water=0.45 * (1 - soil_weight),
        yield_potential=0.30 * (1 - soil_weight),
        risk=0.25 * (1 - soil_weight),
        soil_health=soil_weight,
    )

    # ----------------------------------------------
    # 5. Existing Personal Crop Suitability Engine
    # ----------------------------------------------

    baseline_response = (
        personal_suitability_service.run_personal_suitability(
            field_id=field_id,
            token=token,
            user_id=user_id,
            priorities=priorities
        )
    )

    if baseline_response.data_source != "real":
        raise HTTPException(
            503,
            "Real NASA suitability results unavailable."
        )

    baseline_by_crop = {
        result.crop_id: result
        for result in baseline_response.results
    }

    # ----------------------------------------------
    # 6. Existing Personal Rotation Planner
    # ----------------------------------------------

    rotation_response = (
        personal_rotation_service.run_personal_rotations(
            field_id=field_id,
            token=token,
            user_id=user_id,
            priorities=priorities,
            top_n=8,
            n_slots=3,
            limit=10,
        )
    )

    # ----------------------------------------------
    # 7. Scenario suitability calculation
    # ----------------------------------------------

    scenario_by_crop = _scenario_suitability(
        field=field,
        env=env,
        priorities=priorities,
        rainfall_factor=1 + rain_change / 100,
        temp_delta=temp_change,
        water_factor=water_pct / 100
    )

    # ----------------------------------------------
    # 8. Prepare comparable rotation sequences
    # ----------------------------------------------

    crop_lookup = {
        crop.id: crop
        for crop in load_crops()
    }

    sequences = []

    for option in rotation_response.alternatives:

        ids = option.crop_ids

        if all(
            crop_id in crop_lookup
            and crop_id in baseline_by_crop
            and crop_id in scenario_by_crop
            for crop_id in ids
        ):
            sequences.append(
                tuple(
                    crop_lookup[crop_id]
                    for crop_id in ids
                )
            )

    if not sequences:
        raise HTTPException(
            422,
            "No comparable rotation sequences "
            "with sufficient observations."
        )

    # ----------------------------------------------
    # 9. Common water reference
    # ----------------------------------------------

    water_reference = max(
        sum(
            max(0.0, crop.water_need_mm)
            for crop in sequence
        )
        for sequence in sequences
    )

    if water_reference <= 0:
        raise HTTPException(
            422,
            "Crop water-demand metadata unavailable."
        )

    # ----------------------------------------------
    # 10. Calculate rotation scores
    # ----------------------------------------------

    evaluated = []

    for sequence in sequences:

        baseline_result = score_personal_rotation(
            sequence=sequence,
            suitability_by_crop=baseline_by_crop,
            priorities=priorities,
            water_reference_mm=water_reference
        )

        simulated_result = score_personal_rotation(
            sequence=sequence,
            suitability_by_crop=scenario_by_crop,
            priorities=priorities,
            water_reference_mm=water_reference
        )

        evaluated.append({
            "crop_ids": baseline_result.crop_ids,
            "crop_names": baseline_result.crop_names,

            "baseline_score": baseline_result.score.total,
            "scenario_score": simulated_result.score.total,

            "water_demand_mm": round(
                sum(crop.water_need_mm for crop in sequence),
                2
            ),

            "soil_component": baseline_result.score.soil_impact,
            "resilience_component": baseline_result.score.resilience,

            "baseline_resilience_component": (
                baseline_result.score.resilience
            ),

            "scenario_resilience_component": (
                simulated_result.score.resilience
            ),
        })

    # ----------------------------------------------
    # 11. Select rotation strategies
    # ----------------------------------------------

    selectors = [
        (
            "Water Saver",
            lambda row: (
                row["water_demand_mm"],
                -row["baseline_score"]
            )
        ),
        (
            "Soil Builder",
            lambda row: (
                -row["soil_component"],
                -row["baseline_score"]
            )
        ),
        (
            "Balanced",
            lambda row: (
                -row["baseline_score"],
                row["water_demand_mm"]
            )
        ),
    ]

    strategies = []
    used = set()

    for name, sort_key in selectors:

        available = [
            row
            for row in evaluated
            if tuple(row["crop_ids"]) not in used
        ]

        if not available:
            continue

        chosen = min(
            available,
            key=sort_key
        )

        used.add(tuple(chosen["crop_ids"]))

        strategies.append({
            "name": name,
            **chosen
        })

    best = max(
        strategies,
        key=lambda row: row["scenario_score"]
    )

    # ----------------------------------------------
    # 12. API response
    # ----------------------------------------------

    return {
        "field_id": field.id,
        "field_name": field.name,

        "status": "modeled",

        "method": (
            "Existing personal suitability and rotation engines; "
            "hypothetical effective-rainfall proxy"
        ),

        "data_source": env.source,
        "data_sources": env.sources,

        "period": {
            "start": env.start,
            "end": env.end
        },

        "parameters": {
            "rainfall_pct": rain_change,
            "temperature_delta": temp_change,

            "water_availability": (
                water_label
                if water_label != "Custom"
                else water_pct
            ),

            "soil_recovery": (
                soil_label
                if soil_label != "Custom"
                else soil_pct
            ),

            "water_availability_pct": water_pct,
            "soil_priority_pct": soil_pct,
        },

        "baseline": {
            "rainfall_pct": 100,
            "rainfall_mm": round(rain_mm, 1),
            "temperature_c": round(mean_temp, 1),

            "root_zone_wetness_pct": (
                round(wetness * 100, 1)
                if wetness is not None
                else None
            ),

            "resilience": None,
        },

        "scenario": {
            "rainfall_pct": 100 + rain_change,

            "rainfall_mm": round(
                rain_mm * (1 + rain_change / 100),
                1
            ),

            "temperature_c": round(
                mean_temp + temp_change,
                1
            ),

            "water_availability": water_label,

            "effective_water_multiplier_pct": water_pct,

            "soil_priority_pct": soil_pct,

            "resilience": None,
        },

        "strategies": strategies,

        "chart_data": [
            {
                "case": "Baseline",
                **{
                    strategy["name"]: strategy["baseline_score"]
                    for strategy in strategies
                }
            },
            {
                "case": "Scenario",
                **{
                    strategy["name"]: strategy["scenario_score"]
                    for strategy in strategies
                }
            },
        ],

        "recommended_strategy": best,

        "explanation": (
            f"Rainfall {rain_change:+g}%, "
            f"temperature {temp_change:+g}°C, "
            f"assumed effective-water multiplier {water_pct:g}%, "
            f"soil preference weight {soil_pct:g}%. "
            f"{best['name']} ranks highest "
            f"({best['scenario_score']}/100)."
        ),

        "limitations": [
            (
                "NASA observations describe historical conditions, "
                "not future weather."
            ),
            (
                "Water availability multiplies effective rainfall "
                "as a simplified hypothetical proxy; "
                "it is not measured irrigation or a physical water balance."
            ),
            (
                "Soil recovery is a scoring priority, "
                "not a modeled change in soil fertility."
            ),
            (
                "Baseline and scenario use the same priorities "
                "and crop sequences."
            ),
            (
                "Scores are heuristics, not validated yield "
                "or field resilience forecasts."
            ),
            (
                "The comparison is limited to candidate sequences "
                "returned by the existing rotation planner."
            ),
        ],
    }