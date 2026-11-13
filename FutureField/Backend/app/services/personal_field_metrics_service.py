"""
FutureField — Shared Personal Field Metrics

Single calculation source for:
- My Fields
- Field Intelligence
- Climate Insights
- Seasonal Decision Reports

Uses authenticated field-specific NASA observations.

Never presents mock observations as real measurements.
"""

from __future__ import annotations

import math
from statistics import mean
from typing import Any

from app.services import personal_environment_service


def valid_number(value: Any) -> float | None:
    """Return a finite observation or None."""

    if isinstance(value, bool):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if not math.isfinite(number):
        return None

    if number <= -900:
        return None

    return number


def valid_values(
    values: Any,
    minimum: float | None = None,
    maximum: float | None = None,
) -> list[float]:

    if not isinstance(values, list):
        return []

    result = []

    for value in values:
        number = valid_number(value)

        if number is None:
            continue

        if minimum is not None and number < minimum:
            continue

        if maximum is not None and number > maximum:
            continue

        result.append(number)

    return result


def round_or_none(
    value: float | None,
    digits: int = 1,
) -> float | None:

    return round(value, digits) if value is not None else None


def calculate_water_stress(
    latest_wetness: float | None,
) -> dict:
    """
    Indicative screening based on NASA POWER root-zone wetness.

    Thresholds are provisional, not validated
    crop-specific water-stress thresholds.
    """

    if latest_wetness is None:
        return {
            "level": "Not assessed",
            "status": "unavailable",
            "method": "NASA POWER GWETROOT",
        }

    if latest_wetness < 0.35:
        level = "High"
    elif latest_wetness < 0.65:
        level = "Moderate"
    else:
        level = "Low"

    return {
        "level": level,
        "status": "indicative",
        "method": "NASA POWER GWETROOT",
    }


def calculate_shared_metrics(environment) -> dict:
    """
    Calculate environmental metrics from one
    already-fetched environmental response.
    """

    source = environment.source

    is_real = source in ("real", "partial")

    dates = (environment.daily or {}).get("dates", [])

    if not isinstance(dates, list):
        dates = []

    expected_days = len(dates)

    if not is_real:
        return {
            "field_id": environment.field_id,
            "status": "unavailable",
            "source": source,
            "sources": [],
            "period": {
                "start": environment.start,
                "end": environment.end,
            },
            "rainfall_mm": None,
            "temperature_c": None,
            "root_zone_wetness_pct": None,
            "ndvi": None,
            "water_stress": "Not assessed",
            "water_stress_assessment": {
                "level": "Not assessed",
                "status": "unavailable",
                "method": "NASA POWER GWETROOT",
            },
            "field_health_score": None,
            "data_quality": 0,
            "coverage": {
                "expected_days": expected_days,
                "rainfall_days": 0,
                "temperature_days": 0,
                "wetness_days": 0,
                "ndvi_days": 0,
            },
        }

    daily = environment.daily or {}

    rainfall = valid_values(
        daily.get("rain"),
        minimum=0,
        maximum=500,
    )

    tmax = daily.get("tmax", [])
    tmin = daily.get("tmin", [])

    if not isinstance(tmax, list):
        tmax = []

    if not isinstance(tmin, list):
        tmin = []

    temperatures = []

    for high, low in zip(tmax, tmin):
        high_value = valid_number(high)
        low_value = valid_number(low)

        if (
            high_value is not None
            and low_value is not None
            and -60 <= high_value <= 65
            and -80 <= low_value <= 55
            and high_value >= low_value
        ):
            temperatures.append(
                (high_value + low_value) / 2
            )

    wetness = valid_values(
        daily.get("soil_moisture"),
        minimum=0,
        maximum=1,
    )

    ndvi_values = valid_values(
        daily.get("ndvi"),
        minimum=-1,
        maximum=1,
    )

    rainfall_complete = (
        expected_days > 0
        and len(rainfall) == expected_days
    )

    rainfall_total = (
        sum(rainfall)
        if rainfall_complete
        else None
    )

    temperature_mean = (
        mean(temperatures)
        if temperatures
        else None
    )

    latest_wetness = (
        wetness[-1]
        if wetness
        else None
    )

    latest_ndvi = (
        ndvi_values[-1]
        if ndvi_values
        else None
    )

    wetness_pct = (
        latest_wetness * 100
        if latest_wetness is not None
        else None
    )

    water_stress = calculate_water_stress(
        latest_wetness
    )

    return {
        "field_id": environment.field_id,
        "status": "available",
        "source": source,
        "sources": environment.sources or [],
        "period": {
            "start": environment.start,
            "end": environment.end,
        },

        "rainfall_mm": round_or_none(
            rainfall_total
        ),

        "temperature_c": round_or_none(
            temperature_mean
        ),

        "root_zone_wetness_pct": round_or_none(
            wetness_pct
        ),

        "ndvi": round_or_none(
            latest_ndvi,
            3,
        ),

        "water_stress": water_stress["level"],

        "water_stress_assessment": water_stress,

        # Do not invent a health score.
        "field_health_score": None,

        "data_quality": environment.quality_score,

        "coverage": {
            "expected_days": expected_days,
            "rainfall_days": len(rainfall),
            "temperature_days": len(temperatures),
            "wetness_days": len(wetness),
            "ndvi_days": len(ndvi_values),
            "rainfall_complete": rainfall_complete,
        },
    }


def get_personal_field_metrics(
    field_id: str,
    token: str,
    user_id: str,
    refresh: bool = False,
) -> dict:
    """
    Fetch authenticated field-specific NASA observations
    and calculate shared metrics.
    """

    environment = (
        personal_environment_service.get_personal_environment(
            field_id=field_id,
            token=token,
            user_id=user_id,
            refresh=refresh,
        )
    )

    return calculate_shared_metrics(environment)