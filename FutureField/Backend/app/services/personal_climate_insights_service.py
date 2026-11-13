"""Field-specific climate insights from authenticated NASA observations."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from statistics import mean

from app.services import personal_environment_service


def _number(value):
    if (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value > -90
    ):
        return float(value)
    return None


def _valid_values(values):
    if not isinstance(values, list):
        return []

    result = []
    for value in values:
        number = _number(value)
        if number is not None:
            result.append(number)

    return result


def _average(values):
    return mean(values) if values else None


def _rounded(value, digits=1):
    return round(value, digits) if value is not None else None


def get_personal_climate_insights(
    field_id: str,
    token: str,
    user_id: str,
    refresh: bool = False,
):
    environment = personal_environment_service.get_personal_environment(
        field_id=field_id,
        token=token,
        user_id=user_id,
        refresh=refresh,
    )

    daily = environment.daily or {}
    monthly = environment.monthly or {}

    base_response = {
        "field_id": field_id,
        "source": environment.source,
        "dataset": environment.dataset,
        "period": {
            "start": environment.start,
            "end": environment.end,
        },
        "quality_score": environment.quality_score,
        "sources": environment.sources,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    if environment.source not in ("real", "partial"):
        return {
            **base_response,
            "status": "unavailable",
            "summary": {},
            "daily": {},
            "monthly": [],
            "insights": [],
            "message": "Real environmental observations are unavailable.",
        }

    dates = daily.get("dates", [])

    if not isinstance(dates, list):
        dates = []

    expected_days = len(dates)

    # Preserve the original daily arrays and their date alignment.
    # Missing observations remain None rather than becoming zero.
    cleaned_daily = {"dates": dates}

    for key in (
        "tmax",
        "tmin",
        "rain",
        "rh",
        "soil_moisture",
        "ndvi",
    ):
        original = daily.get(key, [])

        if not isinstance(original, list):
            original = []

        cleaned_daily[key] = [
            _number(original[index]) if index < len(original) else None
            for index in range(expected_days)
        ]

    tmax = _valid_values(cleaned_daily["tmax"])
    rain = _valid_values(cleaned_daily["rain"])
    humidity = _valid_values(cleaned_daily["rh"])
    wetness = _valid_values(cleaned_daily["soil_moisture"])
    ndvi = _valid_values(cleaned_daily["ndvi"])

    temperatures = []

    for high, low in zip(
        cleaned_daily["tmax"],
        cleaned_daily["tmin"],
    ):
        if high is not None and low is not None:
            temperatures.append((high + low) / 2)

    # A period total should not be presented as complete
    # when rainfall observations are missing.
    rainfall_complete = (
        expected_days > 0 and len(rain) == expected_days
    )

    rainfall_total = sum(rain) if rainfall_complete else None

    heat_days = (
        sum(value >= 35 for value in tmax)
        if tmax
        else None
    )

    summary = {
        "average_temperature_c": _rounded(_average(temperatures)),
        "total_rainfall_mm": _rounded(rainfall_total),
        "average_humidity_pct": _rounded(_average(humidity)),
        "average_root_zone_wetness_pct": _rounded(
            _average(wetness) * 100
            if wetness
            else None
        ),
        "latest_ndvi": _rounded(ndvi[-1], 3) if ndvi else None,
        "heat_exposure_days": heat_days,
        "heat_threshold_c": 35,
        "temperature_observed_days": len(temperatures),
        "rainfall_observed_days": len(rain),
        "humidity_observed_days": len(humidity),
        "soil_moisture_observed_days": len(wetness),
        "ndvi_observed_days": len(ndvi),
        "expected_days": expected_days,
    }

    monthly_rows = []

    for month, row in sorted(monthly.items()):
        rain_coverage = row.get("rain_coverage_pct", 0)

        monthly_rows.append({
            "month": month,
            "temperature_c": row.get("tmean_c"),
            "rainfall_mm": (
                row.get("rain_mm")
                if rain_coverage == 100
                else None
            ),
            "rainfall_coverage_pct": rain_coverage,
            "temperature_coverage_pct": row.get(
                "temperature_coverage_pct",
                0,
            ),
            "soil_wetness_pct": row.get("soil_moisture_pct"),
            "ndvi": row.get("ndvi"),
        })

    insights = []

    average_temperature = summary["average_temperature_c"]

    if average_temperature is not None:
        insights.append({
            "title": "Temperature conditions",
            "description": (
                f"Mean observed temperature was "
                f"{average_temperature:.1f}°C."
            ),
        })

    if rainfall_total is not None:
        insights.append({
            "title": "Rainfall conditions",
            "description": (
                f"Total observed rainfall was "
                f"{rainfall_total:.1f} mm."
            ),
        })

    if heat_days is not None:
        insights.append({
            "title": "Heat exposure",
            "description": (
                f"Daily maximum temperature reached or exceeded "
                f"35°C on {heat_days} observed days."
            ),
        })

    if wetness:
        insights.append({
            "title": "Root-zone wetness",
            "description": (
                "Root-zone wetness observations are available "
                "for seasonal moisture analysis."
            ),
        })

    has_observations = any(
        (
            temperatures,
            rain,
            humidity,
            wetness,
            ndvi,
        )
    )

    return {
        **base_response,
        "status": "available" if has_observations else "unavailable",
        "summary": summary,
        "daily": cleaned_daily,
        "monthly": monthly_rows,
        "insights": insights,
    }