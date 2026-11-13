"""Crop Suitability Engine. Stateless: same inputs -> same outputs.

Stage 1: component fit scores (priority-independent)  -> score_components()
Stage 2: priority weights combine them                -> combine()
Hard constraints flag physically infeasible crops     -> check_hard_constraints()
"""
from app.engines import explain, scoring
from app.engines.scoring import clamp01, trapezoid
from app.schemas.analysis import FieldCondition, Priorities, SuitabilityResult
from app.schemas.crop import CropRequirements


def fit_temperature(c: FieldCondition, crop: CropRequirements) -> float:
    """Triangle fit: 0 at temp_min/temp_max, 1 at temp_opt.

    Uses seasonal mean temperature as a proxy for the growing-period thermal regime.
    Limitation: GDD-based completion check would be more accurate but requires
    crop-specific base temperature and seasonal GDD target.
    """
    return trapezoid(c.mean_temp_c, crop.temp_min, crop.temp_opt, crop.temp_opt, crop.temp_max)


def fit_water(c: FieldCondition, crop: CropRequirements) -> float:
    """Water adequacy fit (0..1).

    ratio = water_supply / crop_water_need:
    - ratio < 1  -> proportional shortfall (score = ratio).
    - ratio >= 1 -> over-supply penalised by (1 - flood_tolerance).

    Limitation: does not account for temporal distribution of rainfall.
    dry_spell_max_days in the field flags captures this partially.
    """
    need = max(crop.water_need_mm, 1.0)
    ratio = c.water_supply_mm / need
    if ratio <= 1.0:
        return clamp01(ratio)
    excess_penalty = 0.5 * min(ratio - 1.0, 1.0) * (1.0 - crop.flood_tolerance)
    return clamp01(1.0 - excess_penalty)


def fit_soil(c: FieldCondition, crop: CropRequirements) -> float:
    """Soil suitability fit (0..1).

    pH fit (50%): trapezoid centred on [ph_min, ph_max] with ±1 pH unit ramps.
    Texture fit (30%): 1.0 if field texture in crop's preferred list; 0.5 otherwise.
    Fertility carry-over (20%): soil_fertility_adj from rotation history.

    Limitation: drainage class vs flood/waterlogging tolerance is not scored here.
    """
    ph = trapezoid(c.soil.ph, crop.ph_min - 1, crop.ph_min, crop.ph_max, crop.ph_max + 1)
    tex = 1.0 if c.soil.texture in crop.soil_textures else 0.5
    fertility = clamp01(0.5 + c.soil_fertility_adj)
    return clamp01(0.5 * ph + 0.3 * tex + 0.2 * fertility)


def fit_risk(c: FieldCondition, crop: CropRequirements) -> float:
    """Climate-risk fit (0..1). Penalties from active field flags, weighted by tolerances.

    drought_risk         -> 0.6 × (1 - drought_tolerance)
    heat_stress          -> flat 0.3 penalty (affects all crops similarly)
    flood_risk           -> 0.6 × (1 - flood_tolerance)
    high_rainfall_variability -> 0.1 × (1 - drought_tolerance)  [uneven rain = partial drought]
    high_et_demand       -> 0.1 × (1 - drought_tolerance)       [high evaporation stress]
    """
    penalty = 0.0
    if "drought_risk" in c.flags:
        penalty += 0.6 * (1.0 - crop.drought_tolerance)
    if "heat_stress" in c.flags:
        penalty += 0.3
    if "flood_risk" in c.flags:
        penalty += 0.6 * (1.0 - crop.flood_tolerance)
    if "high_rainfall_variability" in c.flags:
        penalty += 0.1 * (1.0 - crop.drought_tolerance)
    if "high_et_demand" in c.flags:
        penalty += 0.1 * (1.0 - crop.drought_tolerance)
    return clamp01(1.0 - penalty)


def check_hard_constraints(c: FieldCondition, crop: CropRequirements) -> str | None:
    """Return reason string if the crop is physically infeasible, else None.

    Temperature outside absolute tolerance -> infeasible.
    Water supply < 30% of seasonal need   -> severe deficit.
    Soil pH outside ±1.5 of tolerance     -> infeasible.

    Limitation: season-window compatibility (crop.seasons vs current calendar month)
    is not yet enforced here.
    """
    if c.mean_temp_c < crop.temp_min or c.mean_temp_c > crop.temp_max:
        return "Mean temperature is outside the crop's tolerance"
    if c.water_supply_mm < 0.3 * crop.water_need_mm:
        return "Water supply is far below the crop's seasonal need"
    if c.soil.ph < crop.ph_min - 1.5 or c.soil.ph > crop.ph_max + 1.5:
        return "Soil pH is outside the crop's tolerance"
    return None


def score_components(c: FieldCondition, crop: CropRequirements) -> dict[str, float]:
    return {
        "water": fit_water(c, crop),
        "temp":  fit_temperature(c, crop),
        "soil":  fit_soil(c, crop),
        "risk":  fit_risk(c, crop),
    }


def combine(components: dict[str, float], priorities: Priorities) -> tuple[float, dict[str, float]]:
    """Total 0..100 = 100 × Σ w_i s_i, plus normalized weights."""
    weights = scoring.priorities_to_weights(priorities)
    return round(100.0 * scoring.weighted_sum(components, weights), 2), weights


def score_crop(c: FieldCondition, crop: CropRequirements, priorities: Priorities) -> SuitabilityResult:
    comps = {k: round(v, 4) for k, v in score_components(c, crop).items()}
    total, weights = combine(comps, priorities)
    reason = check_hard_constraints(c, crop)
    return SuitabilityResult(
        crop_id=crop.id, crop_name=crop.name, total_score=total,
        components=comps, weights=weights,
        recommended=reason is None, not_recommended_reason=reason,
        explanation=explain.explain_terms(comps, weights),
    )


def rank_crops(c: FieldCondition, crops: list[CropRequirements], priorities: Priorities) -> list[SuitabilityResult]:
    results = [score_crop(c, crop, priorities) for crop in crops]
    return sorted(results, key=lambda r: (not r.recommended, -r.total_score))


def recombine(results: list[SuitabilityResult], priorities: Priorities) -> list[SuitabilityResult]:
    """Slider fast-path: reuse stored component scores, only re-weight."""
    out = []
    for r in results:
        total, weights = combine(r.components, priorities)
        out.append(r.model_copy(update={
            "total_score": total, "weights": weights,
            "explanation": explain.explain_terms(r.components, weights),
        }))
    return sorted(out, key=lambda r: (not r.recommended, -r.total_score))
