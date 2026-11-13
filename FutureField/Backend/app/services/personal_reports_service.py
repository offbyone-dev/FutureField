"""Authenticated, field-specific seasonal decision reports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services import (
    personal_environment_service,
    personal_field_metrics_service,
    supabase_field_service,
)


def field_value(field: Any, key: str, default=None):
    """Support both Pydantic field models and dictionaries."""

    if isinstance(field, dict):
        return field.get(key, default)

    return getattr(field, key, default)


def assess_water_stress(soil_wetness: list[float]) -> dict[str, str]:
    """Provisional NASA POWER GWETROOT wetness screening, not crop stress validation.

    Thresholds are indicative and must not be presented as the validated
    Field Intelligence water score or as direct in-field measurements.
    """
    if not soil_wetness:
        return {"level": "Not assessed", "status": "Unavailable", "method": "NASA POWER GWETROOT"}

    latest = soil_wetness[-1]
    if not 0 <= latest <= 1:
        return {"level": "Not assessed", "status": "Unavailable", "method": "NASA POWER GWETROOT"}

    if latest < 0.35:
        level = "High"
    elif latest < 0.65:
        level = "Moderate"
    else:
        level = "Low"

    return {"level": level, "status": "Indicative", "method": "NASA POWER GWETROOT"}


def calculate_conditions(environment) -> dict:
    """Format shared NASA metrics for the existing Reports frontend."""
    metrics = personal_field_metrics_service.calculate_shared_metrics(environment)
    coverage = metrics["coverage"]
    assessment = metrics["water_stress_assessment"]

    wetness = metrics["root_zone_wetness_pct"]
    rainfall = metrics["rainfall_mm"]
    temperature = metrics["temperature_c"]
    ndvi = metrics["ndvi"]

    return {
        "soil_moisture": f"{wetness:.1f}%" if wetness is not None else "—",
        "rainfall": f"{rainfall:.1f} mm" if rainfall is not None else "—",
        "temperature": f"{temperature:.1f}°C" if temperature is not None else "—",
        "ndvi": f"{ndvi:.3f}" if ndvi is not None else "—",
        "water_stress": assessment["level"],
        "water_stress_status": assessment["status"].capitalize(),
        "water_stress_method": assessment["method"],
        "soil_moisture_value": wetness,
        "rainfall_mm": rainfall,
        "temperature_c": temperature,
        "ndvi_value": ndvi,
        "observation_coverage": {
            "expected_days": coverage["expected_days"],
            "rainfall_days": coverage["rainfall_days"],
            "temperature_days": coverage["temperature_days"],
            "soil_wetness_days": coverage["wetness_days"],
            "ndvi_days": coverage["ndvi_days"],
            "rainfall_complete": coverage["rainfall_complete"],
        },
    }


def build_uncertainties(
    environment,
    conditions: dict,
    field: Any,
) -> list[dict]:

    uncertainties = []

    coverage = conditions["observation_coverage"]

    expected = coverage["expected_days"]

    if expected == 0:
        uncertainties.append({
            "key": "Observation coverage",
            "value": "No dated observations were returned.",
        })

    if not coverage["rainfall_complete"]:
        uncertainties.append({
            "key": "Rainfall coverage",
            "value": (
                "Rainfall observations are incomplete; "
                "a full-period total is not reported."
            ),
        })

    if conditions["ndvi_value"] is None:
        uncertainties.append({
            "key": "NDVI",
            "value": (
                "A verified vegetation observation "
                "is unavailable for this field."
            ),
        })

    if conditions["soil_moisture_value"] is None:
        uncertainties.append({
            "key": "Root-zone wetness",
            "value": (
                "NASA POWER root-zone wetness "
                "is unavailable for this period."
            ),
        })

    soil = field_value(field, "soil")

    if soil is None:
        uncertainties.append({
            "key": "Soil profile",
            "value": "Farmer soil information is unavailable.",
        })
    else:
        uncertainties.append({
            "key": "Soil profile",
            "value": (
                "Soil characteristics are farmer-provided "
                "unless independently verified."
            ),
        })

    uncertainties.append({
        "key": "Spatial resolution",
        "value": (
            "NASA gridded observations represent the "
            "field location, not direct on-farm sensor readings."
        ),
    })

    return uncertainties


def get_personal_report(
    field_id: str,
    token: str,
    user_id: str,
    refresh: bool = False,
) -> dict:
    """
    Generate a report for one authenticated user's field.

    Field ownership is checked by supabase_field_service.
    """

    field = supabase_field_service.get_field(
        field_id=field_id,
        token=token,
        user_id=user_id,
    )

    environment = (
        personal_environment_service.get_personal_environment(
            field_id=field_id,
            token=token,
            user_id=user_id,
            refresh=refresh,
        )
    )

    farm_name = field_value(
        field,
        "farm_name",
        "FutureField Farm",
    )

    field_name = field_value(
        field,
        "name",
        "Unnamed Field",
    )

    area_ha = field_value(field, "area_ha")

    current_crop = field_value(
        field,
        "current_crop",
    ) or "Unspecified"

    district = field_value(field, "district")
    division = field_value(field, "division")

    location = ", ".join(
        str(value)
        for value in (district, division, "Bangladesh")
        if value
    )

    is_real = environment.source in ("real", "partial")

    conditions = calculate_conditions(environment)

    uncertainties = build_uncertainties(
        environment,
        conditions,
        field,
    )

    if is_real and conditions["water_stress_status"] == "Indicative":
        uncertainties.append({
            "key": "Water stress screening",
            "value": (
                "Indicative wetness-based screening from NASA POWER GWETROOT; "
                "not a validated crop-specific water-stress assessment or "
                "the Field Intelligence model score."
            ),
        })

    if not is_real:
        uncertainties.insert(0, {
            "key": "NASA observations",
            "value": (
                "Real observations are unavailable. "
                "Synthetic data has been excluded."
            ),
        })

    # Do not invent a resilience score.
    # It can be populated later from a validated,
    # authenticated personal field-assessment model.

    resilience_score = None
    resilience_label = "Not assessed"

    # Do not call the old demo/local rotation service here.
    # Personal rotation results must be obtained from the
    # authenticated personal rotation pipeline.

    rotation_scenarios = []

    return {
        "report_type": "seasonal_decision_report",

        "report_status": (
            "available"
            if is_real
            else "partial"
        ),

        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),

        "farm_name": farm_name,
        "field_name": field_name,
        "field_id": field_id,

        "area_ha": area_ha,
        "current_crop": current_crop,
        "location": location,

        "resilience_score": resilience_score,
        "resilience_label": resilience_label,

        "conditions": conditions,

        "rotation_scenarios": rotation_scenarios,

        "rotation_status": "not_loaded",

        "uncertainties": uncertainties,

        "data_sources": (
            environment.sources or []
            if is_real
            else []
        ),

        "data_quality": environment.quality_score,

        "observation_period": {
            "start": environment.start,
            "end": environment.end,
        },

        "observation_source": (
            environment.source
            if is_real
            else "unavailable"
        ),

        "notes": [
            (
                "Environmental values are derived from "
                "available observations for the selected field."
            ),
            (
                "Resilience scoring and rotation scenarios "
                "require their authenticated personal "
                "analysis results. Water stress is indicative only."
            ),
        ],
    }