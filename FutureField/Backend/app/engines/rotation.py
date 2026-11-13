"""Rotation Engine. NEVER recomputes crop fit itself: it calls suitability.score_crop per slot
and adds rotation-specific terms (soil carry-over, diversity, water load)."""
from itertools import product

from app.engines import explain, scoring, suitability
from app.engines.scoring import clamp01
from app.schemas.analysis import (FieldCondition, Priorities, RotationScenario, RotationScore)
from app.schemas.crop import CropRequirements


def generate_sequences(crop_ids: list[str], n_slots: int) -> list[tuple[str, ...]]:
    """All ordered sequences. Search space is capped by top_n upstream (6^3 = 216)."""
    return list(product(crop_ids, repeat=n_slots))


def passes_rules(seq: tuple[CropRequirements, ...], rules: dict) -> bool:
    """Hard filters. TODO(inside): disease-break intervals, nitrogen-need sequencing,
    season compatibility per slot (crop.seasons vs slot season)."""
    if rules.get("forbid_same_crop_consecutive", True):
        return all(a.id != b.id for a, b in zip(seq, seq[1:]))
    return True


def apply_soil_carryover(c: FieldCondition, crop: CropRequirements, strength: float) -> FieldCondition:
    """Condition seen by the NEXT slot: fertility adj += strength * crop.soil_effect (clamped)."""
    adj = max(-0.3, min(0.3, c.soil_fertility_adj + strength * crop.soil_effect))
    return c.model_copy(update={"soil_fertility_adj": adj})


def score_sequence(c: FieldCondition, seq: tuple[CropRequirements, ...],
                   priorities: Priorities, rules: dict) -> RotationScenario:
    strength = rules.get("carryover_strength", 0.5)
    cond, slot_scores, fertility_path = c, [], []

    for crop in seq:
        slot_scores.append(suitability.score_crop(cond, crop, priorities).total_score)
        cond = apply_soil_carryover(cond, crop, strength)
        fertility_path.append(cond.soil_fertility_adj)

    n = len(seq)
    suit = sum(slot_scores) / n / 100
    ratio = (sum(cr.water_need_mm for cr in seq) / n) / max(c.water_supply_mm, 1.0)
    water_impact = clamp01(1 - max(0.0, ratio - 0.8))

    # Mean fertility along the ordered path — legumes-before-cereal beats the reverse
    # even when the last slot lands at the same adj.

    soil_impact = clamp01(0.5 + (sum(fertility_path) / n if n else 0.0))
    same_family = sum(1 for a, b in zip(seq, seq[1:]) if a.family == b.family)
    diversity = len({cr.family for cr in seq}) / n
    resilience = clamp01(0.5 * diversity + 0.5 * sum(cr.drought_tolerance for cr in seq) / n
                         - rules.get("same_family_penalty", 0.15) * same_family)
    yield_score = sum(cr.yield_index for cr in seq) / n
    terms = {"suitability": suit, "water_impact": water_impact, "soil_impact": soil_impact,
             "resilience": resilience, "yield": yield_score}
    weights = scoring.rotation_weights(priorities)
    total = round(100 * scoring.weighted_sum(terms, weights), 2)
    return RotationScenario(
        crop_ids=[cr.id for cr in seq], crop_names=[cr.name for cr in seq],
        slot_scores=slot_scores,
        score=RotationScore(total=total, suitability=round(suit, 4), water_impact=round(water_impact, 4),
                            soil_impact=round(soil_impact, 4), resilience=round(resilience, 4),
                            yield_score=round(yield_score, 4),
                            explanation=explain.explain_terms(terms, weights)))


def rank_rotations(c: FieldCondition, candidates: list[CropRequirements], priorities: Priorities,
                   rules: dict, n_slots: int = 3, limit: int = 10) -> list[RotationScenario]:
    by_id = {cr.id: cr for cr in candidates}
    scenarios = []
    for ids in generate_sequences(list(by_id), n_slots):
        seq = tuple(by_id[i] for i in ids)
        if passes_rules(seq, rules):
            scenarios.append(score_sequence(c, seq, priorities, rules))
    return sorted(scenarios, key=lambda s: -s.score.total)[:limit]
