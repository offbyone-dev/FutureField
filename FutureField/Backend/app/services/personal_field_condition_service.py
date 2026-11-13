"""
FutureField — Personal Field Condition Assessment

Experimental environmental condition assessment using:
- Authenticated Supabase field information
- NASA environmental observations
- Crop requirements from crops.json

Important:
- This is not a validated agronomic health model.
- Missing observations never receive invented scores.
- Personal Mode never scores mock observations.
"""

from __future__ import annotations

import math
from typing import Any

from app.knowledge.loader import load_crops
from app.services import (
    personal_environment_service,
    personal_field_metrics_service,
    supabase_field_service,
)


DIMENSION_NAMES = {
    "soil_moisture": "Soil Moisture",
    "rainfall": "Rainfall",
    "temperature": "Temperature",
    "vegetation_health": "Vegetation Health",
    "drought_resilience": "Drought Resilience",
    "water_availability": "Water Availability",
}


def finite_number(value: Any) -> float | None:
    """Return a finite number or None."""

    if isinstance(value, bool):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if not math.isfinite(number):
        return None

    return number


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def get_crop_requirements(current_crop: str | None):
    """
    Match a saved field crop against crops.json.

    Supports:
    - potato
    - Potato
    - POTATO
    """

    if not current_crop:
        return None

    crop_name = str(current_crop).strip().lower()

    for crop in load_crops():
        if (
            crop.id.lower() == crop_name
            or crop.name.lower() == crop_name
        ):
            return crop

    return None


def temperature_suitability_score(
    temperature: float | None,
    crop,
) -> float | None:
    """
    Experimental triangular crop temperature suitability.

    Score:
    - 100 at configured optimal temperature.
    - 0 outside configured minimum/maximum range.

    This is not a validated crop-health score.
    """

    if temperature is None or crop is None:
        return None

    minimum = finite_number(crop.temp_min)
    optimum = finite_number(crop.temp_opt)
    maximum = finite_number(crop.temp_max)

    if (
        minimum is None
        or optimum is None
        or maximum is None
    ):
        return None

    if not (minimum < optimum < maximum):
        return None

    if temperature <= minimum or temperature >= maximum:
        return 0.0

    if temperature == optimum:
        return 100.0

    if temperature < optimum:
        score = (
            (temperature - minimum)
            / (optimum - minimum)
        ) * 100

    else:
        score = (
            (maximum - temperature)
            / (maximum - optimum)
        ) * 100

    return round(clamp(score), 1)


def create_dimension(
    key: str,
    score: float | None = None,
    status: str = "not_assessed",
    explanation: str = "",
    observed_value: float | None = None,
    unit: str | None = None,
    method: str | None = None,
) -> dict:

    return {
        "key": key,
        "name": DIMENSION_NAMES[key],
        "score": score,
        "status": status,
        "observed_value": observed_value,
        "unit": unit,
        "method": method,
        "explanation": explanation,
    }


def create_observation(
    key: str,
    title: str,
    description: str,
    severity: str = "info",
    icon: str = "info",
) -> dict:

    return {
        "key": key,
        "title": title,
        "description": description,
        "severity": severity,
        "icon": icon,
    }


def build_dimensions(metrics: dict, crop) -> list[dict]:
    """
    Build six environmental dimensions.

    Temperature can receive an experimental score.
    Other dimensions remain unscored until suitable
    baselines and assessment methods are available.
    """

    wetness = finite_number(
        metrics.get("root_zone_wetness_pct")
    )

    rainfall = finite_number(
        metrics.get("rainfall_mm")
    )

    temperature = finite_number(
        metrics.get("temperature_c")
    )

    ndvi = finite_number(
        metrics.get("ndvi")
    )

    temperature_score = temperature_suitability_score(
        temperature,
        crop,
    )

    dimensions = []

    # --------------------------------------------------
    # 1. SOIL MOISTURE
    # --------------------------------------------------

    dimensions.append(
        create_dimension(
            key="soil_moisture",
            observed_value=wetness,
            unit="%",
            explanation=(
                "NASA POWER root-zone wetness is available. "
                "A crop-specific moisture scoring method "
                "is required before assigning a score."
                if wetness is not None
                else "Root-zone wetness observations are unavailable."
            ),
            method="NASA POWER GWETROOT",
        )
    )

    # --------------------------------------------------
    # 2. RAINFALL
    # --------------------------------------------------

    dimensions.append(
        create_dimension(
            key="rainfall",
            observed_value=rainfall,
            unit="mm",
            explanation=(
                "Observed rainfall is available. "
                "A comparable historical rainfall baseline "
                "is required for a condition score."
                if rainfall is not None
                else "Complete rainfall observations are unavailable."
            ),
            method="NASA POWER precipitation",
        )
    )

    # --------------------------------------------------
    # 3. TEMPERATURE
    # --------------------------------------------------

    if temperature_score is not None:

        dimensions.append(
            create_dimension(
                key="temperature",
                score=temperature_score,
                status="experimental",
                observed_value=temperature,
                unit="°C",
                method="Triangular crop temperature suitability",
                explanation=(
                    f"Temperature suitability is estimated using "
                    f"the configured temperature range for "
                    f"{crop.name}. The score is experimental "
                    f"and uses the available observation-period "
                    f"mean temperature."
                ),
            )
        )

    else:

        dimensions.append(
            create_dimension(
                key="temperature",
                observed_value=temperature,
                unit="°C",
                explanation=(
                    "Temperature observations or matching "
                    "crop requirements are unavailable."
                ),
            )
        )

    # --------------------------------------------------
    # 4. VEGETATION HEALTH
    # --------------------------------------------------

    dimensions.append(
        create_dimension(
            key="vegetation_health",
            observed_value=ndvi,
            method="NASA vegetation observations",
            explanation=(
                "NDVI is available. A historical vegetation "
                "baseline and crop growth-stage context "
                "are required before assigning a score."
                if ndvi is not None
                else "NDVI observations are unavailable."
            ),
        )
    )

    # --------------------------------------------------
    # 5. DROUGHT RESILIENCE
    # --------------------------------------------------

    dimensions.append(
        create_dimension(
            key="drought_resilience",
            explanation=(
                "A drought resilience score requires "
                "a documented method combining dry spells, "
                "crop drought tolerance, and water conditions."
            ),
        )
    )

    # --------------------------------------------------
    # 6. WATER AVAILABILITY
    # --------------------------------------------------

    dimensions.append(
        create_dimension(
            key="water_availability",
            explanation=(
                "A water availability score requires "
                "crop-season water demand, effective rainfall, "
                "and verified irrigation supply information."
            ),
        )
    )

    return dimensions


def build_observations(
    metrics: dict,
    crop,
) -> list[dict]:
    """Generate field-specific observations."""

    observations = []

    wetness = finite_number(
        metrics.get("root_zone_wetness_pct")
    )

    rainfall = finite_number(
        metrics.get("rainfall_mm")
    )

    temperature = finite_number(
        metrics.get("temperature_c")
    )

    ndvi = finite_number(
        metrics.get("ndvi")
    )

    water_stress = metrics.get(
        "water_stress",
        "Not assessed",
    )

    # --------------------------------------------------
    # WATER CONDITION
    # --------------------------------------------------

    if wetness is not None:

        severity = (
            "warning"
            if water_stress in ("Moderate", "High")
            else "success"
        )

        observations.append(
            create_observation(
                key="water_condition",
                title=f"{water_stress} Water Stress",
                description=(
                    f"NASA POWER root-zone wetness is "
                    f"{wetness:.1f}%. The current "
                    f"water-stress classification is "
                    f"indicative and should be checked "
                    f"against field conditions."
                ),
                severity=severity,
                icon="droplets",
            )
        )

    # --------------------------------------------------
    # VEGETATION
    # --------------------------------------------------

    if ndvi is not None:

        observations.append(
            create_observation(
                key="vegetation",
                title="Vegetation Observation",
                description=(
                    f"The latest available NDVI is "
                    f"{ndvi:.3f}. Historical comparisons "
                    f"and crop growth-stage information "
                    f"are required to assess vegetation health."
                ),
                severity="info",
                icon="leaf",
            )
        )

    # --------------------------------------------------
    # RAINFALL
    # --------------------------------------------------

    if rainfall is not None:

        observations.append(
            create_observation(
                key="rainfall",
                title="Rainfall Summary",
                description=(
                    f"Cumulative observed rainfall is "
                    f"{rainfall:.1f} mm for the selected "
                    f"observation period. This is not "
                    f"automatically the crop-season "
                    f"effective rainfall."
                ),
                severity="info",
                icon="cloud-rain",
            )
        )

    # --------------------------------------------------
    # TEMPERATURE
    # --------------------------------------------------

    if temperature is not None:

        if crop is not None:

            maximum = finite_number(crop.temp_max)
            minimum = finite_number(crop.temp_min)

            if (
                maximum is not None
                and temperature > maximum
            ):

                observations.append(
                    create_observation(
                        key="temperature",
                        title=f"{crop.name} Temperature Alert",
                        description=(
                            f"The observation-period mean "
                            f"temperature is {temperature:.1f}°C, "
                            f"above the configured upper "
                            f"temperature threshold of "
                            f"{maximum:.1f}°C. Confirm that "
                            f"the observation period overlaps "
                            f"the crop growing season."
                        ),
                        severity="warning",
                        icon="thermometer",
                    )
                )

            elif (
                minimum is not None
                and temperature < minimum
            ):

                observations.append(
                    create_observation(
                        key="temperature",
                        title=f"{crop.name} Temperature Alert",
                        description=(
                            f"The observation-period mean "
                            f"temperature is {temperature:.1f}°C, "
                            f"below the configured minimum "
                            f"temperature threshold of "
                            f"{minimum:.1f}°C."
                        ),
                        severity="warning",
                        icon="thermometer",
                    )
                )

            else:

                observations.append(
                    create_observation(
                        key="temperature",
                        title="Temperature Conditions",
                        description=(
                            f"Observed mean temperature is "
                            f"{temperature:.1f}°C. "
                            f"Crop-stage-specific analysis "
                            f"is needed for a more reliable "
                            f"temperature assessment."
                        ),
                        severity="info",
                        icon="thermometer",
                    )
                )

        else:

            observations.append(
                create_observation(
                    key="temperature",
                    title="Temperature Conditions",
                    description=(
                        f"Observed mean temperature is "
                        f"{temperature:.1f}°C. A matching "
                        f"crop profile is required for "
                        f"crop-specific interpretation."
                    ),
                    severity="info",
                    icon="thermometer",
                )
            )

    if not observations:

        observations.append(
            create_observation(
                key="data_unavailable",
                title="Environmental Data Unavailable",
                description=(
                    "No usable real environmental "
                    "observations are currently available "
                    "for this field."
                ),
                severity="warning",
                icon="alert-circle",
            )
        )

    return observations


def get_personal_field_condition(
    field_id: str,
    token: str,
    user_id: str,
    refresh: bool = False,
) -> dict:
    """
    Return a personal field condition assessment.

    All calculations are based on authenticated
    field-specific environmental data.
    """

    # --------------------------------------------------
    # 1. VERIFY FIELD OWNERSHIP
    # --------------------------------------------------

    field = supabase_field_service.get_field(
        field_id=field_id,
        token=token,
        user_id=user_id,
    )

    # --------------------------------------------------
    # 2. FETCH ENVIRONMENTAL DATA
    # --------------------------------------------------

    environment = (
        personal_environment_service.get_personal_environment(
            field_id=field_id,
            token=token,
            user_id=user_id,
            refresh=refresh,
        )
    )

    # --------------------------------------------------
    # 3. SHARED NASA METRICS
    # --------------------------------------------------

    metrics = (
        personal_field_metrics_service.calculate_shared_metrics(
            environment
        )
    )

    # --------------------------------------------------
    # 4. FIND CROP REQUIREMENTS
    # --------------------------------------------------

    current_crop = getattr(
        field,
        "current_crop",
        None,
    )

    crop = get_crop_requirements(
        current_crop
    )

    # --------------------------------------------------
    # 5. BUILD DIMENSIONS
    # --------------------------------------------------

    dimensions = build_dimensions(
        metrics,
        crop,
    )

    # --------------------------------------------------
    # 6. BUILD OBSERVATIONS
    # --------------------------------------------------

    observations = build_observations(
        metrics,
        crop,
    )

    # --------------------------------------------------
    # 7. OVERALL SCORE
    # --------------------------------------------------

    # A six-dimensional overall score must not be
    # calculated while dimensions remain unassessed.

    overall_score = None

    assessment_status = "not_assessed"

    if any(
        dimension["score"] is not None
        for dimension in dimensions
    ):
        assessment_status = "partial"

    # --------------------------------------------------
    # 8. RESPONSE
    # --------------------------------------------------

    return {
        "field_id": field_id,
        "field_name": getattr(
            field,
            "name",
            "Unnamed Field",
        ),
        "current_crop": current_crop,
        "crop_profile_found": crop is not None,
        "source": metrics.get("source"),
        "sources": metrics.get("sources", []),
        "period": metrics.get("period"),
        "data_quality": metrics.get("data_quality"),
        "assessment_type": "experimental",
        "assessment_status": assessment_status,
        "overall_score": overall_score,
        "overall_label": "Not assessed",
        "dimensions": dimensions,
        "observations": observations,
        "disclaimer": (
            "This is an experimental environmental "
            "condition assessment, not a validated "
            "crop-health or yield prediction model."
        ),
    }