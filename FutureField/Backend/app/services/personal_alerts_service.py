"""
FutureField — Personal Alerts Service.

Generates field-specific environmental alerts from
authenticated Supabase fields and NASA observations.

Personal Mode:
- No demo fields.
- No mock alerts.
- No shared alert state.
- No cross-user field access.
"""

import hashlib
import json
import math
from datetime import datetime, timezone

from fastapi import HTTPException

from app.services import (
    personal_environment_service,
    supabase_field_service,
)


def _number(value):
    if isinstance(value, bool):
        return None

    try:
        number = float(value)

        if math.isfinite(number):
            return number
    except (TypeError, ValueError):
        pass

    return None


def _alert_id(field_id, alert_type, observation_date):
    raw = f"{field_id}:{alert_type}:{observation_date}"

    return hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()[:24]


def _observation_date(env):
    return str(env.end)


def _make_alert(
    field,
    alert_type,
    title,
    description,
    severity,
    source,
    observation_date,
    observation,
    historical_context,
    recommendation,
):
    return {
        "id": _alert_id(
            field.id,
            alert_type,
            observation_date,
        ),
        "title": title,
        "desc": description,
        "severity": severity,
        "source": source,
        "date": observation_date,
        "unread": True,
        "field_id": field.id,
        "field_name": field.name,
        "obs": observation,
        "hist": historical_context,
        "monitor": recommendation,
    }


def _generate_field_alerts(field, env):

    # Never generate personal alerts from mock data.
    if env.source not in ("real", "partial"):
        return []

    indicators = env.indicators or {}

    alerts = []

    observation_date = _observation_date(env)

    # ----------------------------------------------
    # Water Stress
    # ----------------------------------------------

    soil_moisture = _number(
        indicators.get("soil_moisture_latest_pct")
    )

    if soil_moisture is None:
        soil_moisture = _number(
            indicators.get("soil_moisture_pct")
        )

    if soil_moisture is not None and soil_moisture < 25:

        severity = (
            "High"
            if soil_moisture < 15
            else "Moderate"
        )

        alerts.append(
            _make_alert(
                field=field,
                alert_type="water_stress",
                title="Water Stress",
                description=(
                    f"Low soil moisture was observed "
                    f"near {field.name}."
                ),
                severity=severity,
                source="NASA POWER GWETROOT",
                observation_date=observation_date,
                observation=(
                    f"{soil_moisture:.1f}% soil moisture"
                ),
                historical_context=(
                    "Based on the latest available "
                    "NASA POWER soil wetness indicator."
                ),
                recommendation=(
                    "Check field moisture and irrigation "
                    "requirements before taking action."
                ),
            )
        )

    # ----------------------------------------------
    # Temperature
    # ----------------------------------------------

    heat_days = _number(
        indicators.get("heat_stress_days")
    )

    if heat_days is not None and heat_days >= 3:

        alerts.append(
            _make_alert(
                field=field,
                alert_type="temperature",
                title="Temperature",
                description=(
                    f"Multiple hot days were observed "
                    f"near {field.name}."
                ),
                severity="Moderate",
                source="NASA POWER",
                observation_date=observation_date,
                observation=(
                    f"{heat_days:.0f} hot days"
                ),
                historical_context=(
                    "Temperature conditions were assessed "
                    "using NASA POWER observations."
                ),
                recommendation=(
                    "Monitor crop heat sensitivity "
                    "and irrigation requirements."
                ),
            )
        )

    # ----------------------------------------------
    # Rain Event
    # ----------------------------------------------

    daily = env.daily or {}

    rain_values = [
        _number(value)
        for value in daily.get("rain", [])
    ]

    valid_recent_rain = [
        value
        for value in rain_values[-3:]
        if value is not None
    ]

    if len(valid_recent_rain) == 3:

        rainfall = sum(valid_recent_rain)

        if rainfall > 40:

            alerts.append(
                _make_alert(
                    field=field,
                    alert_type="rain_event",
                    title="Rain Event",
                    description=(
                        f"Significant rainfall was observed "
                        f"near {field.name}."
                    ),
                    severity="Info",
                    source="NASA POWER PRECTOTCORR",
                    observation_date=observation_date,
                    observation=(
                        f"{rainfall:.1f} mm over 3 days"
                    ),
                    historical_context=(
                        "Three-day rainfall accumulation "
                        "from available NASA observations."
                    ),
                    recommendation=(
                        "Check drainage and monitor "
                        "possible waterlogging."
                    ),
                )
            )

    # ----------------------------------------------
    # Vegetation Change
    # ----------------------------------------------

    ndvi_trend = _number(
        indicators.get("ndvi_trend")
    )

    ndvi_latest = _number(
        indicators.get("ndvi_latest")
    )

    if (
        ndvi_trend is not None
        and ndvi_latest is not None
        and ndvi_trend < 0
    ):

        alerts.append(
            _make_alert(
                field=field,
                alert_type="vegetation_change",
                title="Vegetation Change",
                description=(
                    f"Declining vegetation conditions "
                    f"were observed near {field.name}."
                ),
                severity="Low",
                source="NASA MODIS NDVI",
                observation_date=observation_date,
                observation=f"NDVI {ndvi_latest:.2f}",
                historical_context=(
                    "Negative vegetation index trend "
                    "in available NASA observations."
                ),
                recommendation=(
                    "Compare vegetation changes with "
                    "rainfall and field observations."
                ),
            )
        )

    return alerts


def get_personal_alerts(
    token: str,
    user_id: str,
    field_id: str | None = None,
):

    if field_id:

        fields = [
            supabase_field_service.get_field(
                field_id,
                token,
                user_id,
            )
        ]

    else:

        fields = supabase_field_service.list_fields(
            token,
            user_id,
        )

    if not fields:
        return {
            "alerts": [],
            "unread_count": 0,
        }

    all_alerts = []

    for field in fields:

        env = (
            personal_environment_service
            .get_personal_environment(
                field_id=field.id,
                token=token,
                user_id=user_id,
            )
        )

        all_alerts.extend(
            _generate_field_alerts(field, env)
        )

    return {
        "alerts": all_alerts,
        "unread_count": sum(
            1
            for alert in all_alerts
            if alert["unread"]
        ),
    }