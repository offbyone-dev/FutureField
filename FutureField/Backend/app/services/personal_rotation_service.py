"""
FutureField — Personal Rotation Service.

Combines authenticated farmer fields, historical NASA-based
crop suitability, farmer-reported crop history, and
rotation heuristics.

Current rotation is derived from actual crop history.
"""

from itertools import product

from fastapi import HTTPException

from app.engines.personal_rotation_scoring import (
    score_personal_rotation,
)
from app.engines.rotation_history import (
    extract_current_rotation,
)
from app.knowledge.loader import load_crops
from app.schemas.personal_rotation import (
    PersonalRotationResponse,
    PersonalRotationStrategy,
    RotationSeasonStatus,
)
from app.schemas.analysis import Priorities
from app.services import (
    personal_suitability_service,
    supabase_field_service,
)


def _season_status():
    return RotationSeasonStatus(
        status="not_assessed",
        reason=(
            "A complete multi-slot planting schedule cannot "
            "be verified from the available crop calendar."
        ),
        verified=False,
    )


def _strategy(
    sequence,
    suitability_by_crop,
    priorities,
    water_reference,
    strategy_id,
    strategy_type,
    title,
):
    scored = score_personal_rotation(
        sequence=sequence,
        suitability_by_crop=suitability_by_crop,
        priorities=priorities,
        water_reference_mm=water_reference,
    )

    total_water = round(
        sum(crop.water_need_mm for crop in sequence),
        2,
    )

    families = [crop.family for crop in sequence]

    benefits = []

    if len(set(families)) > 1:
        benefits.append(
            "Includes crops from multiple botanical families."
        )

    if any(crop.soil_effect > 0 for crop in sequence):
        benefits.append(
            "Includes a crop with a positive soil-effect "
            "indicator in the crop knowledge base."
        )

    risks = []

    if any(
        not suitability_by_crop[crop.id].recommended
        for crop in sequence
    ):
        risks.append(
            "One or more crops fail a historical "
            "suitability hard constraint."
        )

    if any(
        first.family == second.family
        for first, second in zip(sequence, sequence[1:])
    ):
        risks.append(
            "Consecutive crops share a botanical family."
        )

    limitations = [
        "Crop suitability is based on historical observations.",
        "Rotation scores are heuristic, not validated forecasts.",
        "Water demand is based on crop metadata, not measured use.",
        "Season-by-season planting feasibility is not verified.",
    ]

    return PersonalRotationStrategy(
        strategy_id=strategy_id,
        strategy_type=strategy_type,
        title=title,
        crop_ids=scored.crop_ids,
        crop_names=scored.crop_names,
        slot_scores=scored.slot_scores,
        score=scored.score,
        total_water_demand_mm=total_water,
        season_assessment=_season_status(),
        benefits=benefits,
        risks=risks,
        evidence=[
            "Historical NASA environmental observations "
            "used by the Personal Crop Suitability Engine.",
            "Farmer-provided soil information.",
            "Crop characteristics from the project knowledge base.",
        ],
        limitations=limitations,
    )


def run_personal_rotations(
    field_id: str,
    token: str,
    user_id: str,
    priorities: Priorities,
    top_n: int = 6,
    n_slots: int = 3,
    limit: int = 5,
) -> PersonalRotationResponse:

    # Validate request parameters.
    if not (2 <= top_n <= 8):
        raise HTTPException(
            status_code=422,
            detail="top_n must be between 2 and 8.",
        )

    if not (2 <= n_slots <= 4):
        raise HTTPException(
            status_code=422,
            detail="n_slots must be between 2 and 4.",
        )

    if not (2 <= limit <= 10):
        raise HTTPException(
            status_code=422,
            detail="limit must be between 2 and 10.",
        )

    # Load authenticated farmer field.
    field = supabase_field_service.get_field(
        field_id=field_id,
        token=token,
        user_id=user_id,
    )

    # Obtain NASA-based crop suitability.
    suitability_response = (
        personal_suitability_service.run_personal_suitability(
            field_id=field_id,
            token=token,
            user_id=user_id,
            priorities=priorities,
        )
    )

    if suitability_response.data_source != "real":
        raise HTTPException(
            status_code=422,
            detail="Real NASA observations are required.",
        )

    crops = load_crops()

    crops_by_id = {
        crop.id: crop
        for crop in crops
    }

    suitability_by_crop = {
        result.crop_id: result
        for result in suitability_response.results
    }

    # --------------------------------------------------
    # Current Rotation from Crop History
    # --------------------------------------------------

    # Farmer's actual crop history is the only source
    # for determining the current rotation.
    #
    # Existing rotation and previous crops are not used.

    history = extract_current_rotation(
        field.crop_history,
        n_slots=n_slots,
    )

    current_ids = (
        history.crop_ids
        if history.status == "available"
        else []
    )

    history_status = history.status
    history_message = history.message

    # Support both crop IDs and crop names in history.
    crop_lookup = {}

    for crop in crops:
        crop_lookup[crop.id.strip().casefold()] = crop.id
        crop_lookup[crop.name.strip().casefold()] = crop.id

    current_ids = [
        crop_lookup.get(
            crop_id.strip().casefold(),
            crop_id.strip().casefold(),
        )
        for crop_id in current_ids
    ]

    # --------------------------------------------------
    # Validate Current Rotation
    # --------------------------------------------------

    current_scoreable = bool(current_ids) and all(
        crop_id in crops_by_id
        and crop_id in suitability_by_crop
        for crop_id in current_ids
    )

    if current_ids and not current_scoreable:
        history_status = "insufficient"
        history_message = (
            "Reported crop history is available, but one or "
            "more crops lack metadata or sufficient NASA "
            "observations for a comparable score."
        )

    # --------------------------------------------------
    # Eligible Alternative Crops
    # --------------------------------------------------

    eligible = [
        crops_by_id[result.crop_id]
        for result in suitability_response.results
        if result.recommended
        and result.crop_id in crops_by_id
    ]

    candidates = eligible[:top_n]

    if len(candidates) < 2:
        raise HTTPException(
            status_code=422,
            detail=(
                "At least two crops with sufficient historical "
                "suitability evidence are required."
            ),
        )

    # --------------------------------------------------
    # Generate Alternative Rotations
    # --------------------------------------------------

    sequences = []

    for sequence in product(
        candidates,
        repeat=n_slots,
    ):
        # Avoid identical consecutive crops.
        if any(
            first.id == second.id
            for first, second in zip(
                sequence,
                sequence[1:],
            )
        ):
            continue

        sequences.append(sequence)

    # --------------------------------------------------
    # Current Rotation Baseline
    # --------------------------------------------------

    baseline_sequence = None

    if current_scoreable:
        baseline_sequence = tuple(
            crops_by_id[crop_id]
            for crop_id in current_ids
        )

    # --------------------------------------------------
    # Shared Water Reference
    # --------------------------------------------------

    comparison_sequences = list(sequences)

    if baseline_sequence is not None:
        comparison_sequences.append(
            baseline_sequence
        )

    water_reference = max(
        (
            sum(
                crop.water_need_mm
                for crop in sequence
            )
            for sequence in comparison_sequences
        ),
        default=0.0,
    )

    if water_reference <= 0:
        raise HTTPException(
            status_code=422,
            detail="Crop water-demand metadata is unavailable.",
        )

    # --------------------------------------------------
    # Score Current Reported Rotation
    # --------------------------------------------------

    current_rotation = None

    if baseline_sequence is not None:
        current_rotation = _strategy(
            sequence=baseline_sequence,
            suitability_by_crop=suitability_by_crop,
            priorities=priorities,
            water_reference=water_reference,
            strategy_id="current",
            strategy_type="current",
            title="Current Reported Rotation",
        )

    # --------------------------------------------------
    # Score Alternative Rotations
    # --------------------------------------------------

    ranked = []

    for sequence in sequences:
        ids = [
            crop.id
            for crop in sequence
        ]

        # Do not duplicate the current rotation.
        if ids == current_ids:
            continue

        strategy = _strategy(
            sequence=sequence,
            suitability_by_crop=suitability_by_crop,
            priorities=priorities,
            water_reference=water_reference,
            strategy_id=(
                "alternative-" + "-".join(ids)
            ),
            strategy_type="alternative",
            title=" → ".join(
                crop.name
                for crop in sequence
            ),
        )

        ranked.append(strategy)

    # --------------------------------------------------
    # Rank Alternative Strategies
    # --------------------------------------------------

    ranked.sort(
        key=lambda strategy: (
            -strategy.score.total,
            strategy.strategy_id,
        )
    )

    alternatives = ranked[:limit]

    # --------------------------------------------------
    # Final API Response
    # --------------------------------------------------

    return PersonalRotationResponse(
        field_id=field_id,
        data_source="real",
        simulated=False,
        data_quality=suitability_response.data_quality,
        current_rotation=current_rotation,
        alternatives=alternatives,
        history_status=history_status,
        history_message=history_message,
    )