"""
FutureField — Personal Rotation Scoring.

Uses crop-specific historical suitability results.
Does not forecast future weather, yield, irrigation or soil changes.
"""

from app.engines import scoring
from app.engines.scoring import clamp01
from app.schemas.analysis import (
    Priorities,
    RotationScenario,
    RotationScore,
    SuitabilityResult,
)
from app.schemas.crop import CropRequirements


def score_personal_rotation(
    sequence: tuple[CropRequirements, ...],
    suitability_by_crop: dict[str, SuitabilityResult],
    priorities: Priorities,
    water_reference_mm: float | None = None,
) -> RotationScenario:

    if not sequence:
        raise ValueError("Rotation sequence cannot be empty.")

    slot_scores = []

    for crop in sequence:
        result = suitability_by_crop.get(crop.id)

        if result is None:
            raise ValueError(
                f"Suitability unavailable for crop: {crop.id}"
            )

        slot_scores.append(result.total_score)

    n = len(sequence)

    suitability_component = clamp01(
        sum(slot_scores) / (100.0 * n)
    )

    total_water_demand = sum(
        max(0.0, crop.water_need_mm)
        for crop in sequence
    )

    # Relative comparison within the same candidate set.
    # Not an estimate of irrigation requirements or savings.
    if water_reference_mm is None:
        water_component = 0.5
    elif water_reference_mm <= 0:
        raise ValueError("Water reference must be positive.")
    else:
        water_component = clamp01(
            1.0 - 0.5 * total_water_demand / water_reference_mm
        )

    fertility_adjustment = 0.0
    fertility_path = []

    for crop in sequence:
        fertility_adjustment = max(
            -0.3,
            min(
                0.3,
                fertility_adjustment + 0.5 * crop.soil_effect,
            ),
        )
        fertility_path.append(fertility_adjustment)

    soil_component = clamp01(
        0.5 + sum(fertility_path) / n
    )

    diversity = len({crop.family for crop in sequence}) / n

    drought_tolerance = sum(
        crop.drought_tolerance
        for crop in sequence
    ) / n

    repeated_family = sum(
        first.family == second.family
        for first, second in zip(sequence, sequence[1:])
    )

    resilience_component = clamp01(
        0.5 * diversity
        + 0.5 * drought_tolerance
        - 0.15 * repeated_family
    )

    yield_component = clamp01(
        sum(crop.yield_index for crop in sequence) / n
    )

    components = {
        "suitability": suitability_component,
        "water_impact": water_component,
        "soil_impact": soil_component,
        "resilience": resilience_component,
        "yield": yield_component,
    }

    weights = scoring.rotation_weights(priorities)

    total = round(
        100.0 * scoring.weighted_sum(components, weights),
        2,
    )

    return RotationScenario(
        crop_ids=[crop.id for crop in sequence],
        crop_names=[crop.name for crop in sequence],
        slot_scores=slot_scores,
        score=RotationScore(
            total=total,
            suitability=round(suitability_component, 4),
            water_impact=round(water_component, 4),
            soil_impact=round(soil_component, 4),
            resilience=round(resilience_component, 4),
            yield_score=round(yield_component, 4),
            explanation=[],
        ),
    )