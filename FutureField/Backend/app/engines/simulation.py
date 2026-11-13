"""Scenario Lab: applies what-if deltas to INDICATORS, then the same engines are re-run.
This is a rule-based sensitivity analysis, NOT a crop-growth or climate model."""
from app.schemas.analysis import CropDelta, SimulationParams, SuitabilityResult

LIMITATION = ("Rule-based sensitivity analysis on seasonal indicators; "
              "not a crop-growth or climate model.")


def apply_simulation(indicators: dict[str, float], p: SimulationParams) -> tuple[dict[str, float], float]:
    """Return (modified_indicators, irrigation_scale).
    TODO(inside): better dry-spell/heat-stress response (apply deltas to the DAILY series and
    recompute indicators instead of scaling aggregates); water_availability for rainfed fields
    (soil moisture) - today it only scales irrigation."""
    ind = dict(indicators)
    ind["rain_total_mm"] = max(0.0, ind["rain_total_mm"] * (1 + p.rainfall_pct / 100))
    ind["dry_spell_max_days"] = max(0.0, ind["dry_spell_max_days"] * (1 - p.rainfall_pct / 100))
    ind["mean_temp_c"] += p.temperature_delta_c
    ind["gdd"] += p.temperature_delta_c * ind.get("season_days", 0.0)
    ind["heat_stress_days"] += max(0.0, p.temperature_delta_c) * 3.0
    return ind, max(0.0, 1 + p.water_availability_pct / 100)


def compare_suitability(base: list[SuitabilityResult], sim: list[SuitabilityResult]) -> list[CropDelta]:
    """Score deltas, rank changes, newly infeasible crops, big component drops."""
    sim_by = {r.crop_id: (i + 1, r) for i, r in enumerate(sim)}
    deltas = []
    for i, b in enumerate(base):
        if b.crop_id not in sim_by:
            continue
        rank_s, s = sim_by[b.crop_id]
        risk = None
        if b.recommended and not s.recommended:
            risk = s.not_recommended_reason
        elif s.components["water"] < b.components["water"] - 0.2:
            risk = "Water fit drops significantly"
        deltas.append(CropDelta(
            crop_id=b.crop_id, crop_name=b.crop_name, baseline_score=b.total_score,
            simulated_score=s.total_score, score_delta=round(s.total_score - b.total_score, 2),
            baseline_rank=i + 1, simulated_rank=rank_s, rank_change=(i + 1) - rank_s, new_risk=risk))
    return deltas
