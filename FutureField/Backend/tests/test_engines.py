"""Pure engine tests: fixed inputs, no HTTP, no files."""
import pytest

from app.engines import rotation, scoring, simulation, suitability
from app.knowledge.loader import load_crops, load_rotation_rules
from app.schemas.analysis import FieldCondition, Priorities, SimulationParams
from app.schemas.field import SoilInfo


def make_condition(**over) -> FieldCondition:
    base = dict(mean_temp_c=24.0, rain_total_mm=500, water_supply_mm=500, dry_spell_max_days=5,
                season_days=120, soil=SoilInfo(texture="loam", ph=6.5), water_score=0.5,
                heat_score=0.8, soil_score=0.8, vegetation_score=0.5, flags=[], confidence=0.9)
    base.update(over)
    return FieldCondition(**base)


def test_trapezoid_shape():
    assert scoring.trapezoid(20, 10, 20, 20, 30) == 1.0
    assert scoring.trapezoid(10, 10, 20, 20, 30) == 0.0
    assert scoring.trapezoid(15, 10, 20, 20, 30) == pytest.approx(0.5)


def test_weights_sum_to_one():
    w = scoring.priorities_to_weights(Priorities(water=1.0, risk=0.0))
    assert sum(w.values()) == pytest.approx(1.0)
    assert w["water"] > w["risk"]


def test_scores_in_range_and_deterministic():
    c, crops, p = make_condition(), load_crops(), Priorities()
    a, b = suitability.rank_crops(c, crops, p), suitability.rank_crops(c, crops, p)
    assert a == b
    assert all(0 <= r.total_score <= 100 for r in a)


def test_hard_constraint_flags_infeasible_crop():
    hot = make_condition(mean_temp_c=45.0)
    assert all(not r.recommended for r in suitability.rank_crops(hot, load_crops(), Priorities()))


def test_priority_only_changes_weights_not_components():
    c, crops = make_condition(), load_crops()
    r1 = suitability.rank_crops(c, crops, Priorities(water=0.0))
    r2 = suitability.rank_crops(c, crops, Priorities(water=1.0))
    assert {r.crop_id: r.components for r in r1} == {r.crop_id: r.components for r in r2}


def test_recombine_matches_full_rank():
    c, crops, p = make_condition(), load_crops(), Priorities(water=0.9)
    full = suitability.rank_crops(c, crops, p)
    fast = suitability.recombine(suitability.rank_crops(c, crops, Priorities()), p)
    assert [(r.crop_id, r.total_score) for r in full] == [(r.crop_id, r.total_score) for r in fast]


def test_zero_simulation_is_identity():
    ind = {"rain_total_mm": 500.0, "dry_spell_max_days": 6.0, "mean_temp_c": 25.0, "gdd": 1800.0,
           "heat_stress_days": 3.0, "season_days": 120.0}
    out, scale = simulation.apply_simulation(ind, SimulationParams())
    assert out == ind and scale == 1.0


def test_rotation_never_repeats_crop_consecutively():
    crops = load_crops()[:4]
    rots = rotation.rank_rotations(make_condition(), crops, Priorities(), load_rotation_rules(), n_slots=3)
    assert rots and all(a != b for r in rots for a, b in zip(r.crop_ids, r.crop_ids[1:]))


def test_trapezoid_degenerate_edges():
    assert scoring.trapezoid(15, 10, 10, 20, 30) == 1.0
    assert scoring.trapezoid(25, 10, 20, 30, 30) == 1.0


def test_hard_constraint_water_and_ph():
    dry = make_condition(water_supply_mm=50)
    rice = next(c for c in load_crops() if c.id == "rice")
    assert suitability.check_hard_constraints(dry, rice) is not None
    sour = make_condition(soil=SoilInfo(texture="loam", ph=3.0))
    wheat = next(c for c in load_crops() if c.id == "wheat")
    assert suitability.check_hard_constraints(sour, wheat) is not None


def test_rotation_order_changes_soil_and_slot_scores():
    crops = {c.id: c for c in load_crops()}
    lentil, maize = crops["lentil"], crops["maize"]
    rules = load_rotation_rules()
    p, c = Priorities(), make_condition()
    a = rotation.score_sequence(c, (lentil, maize), p, rules)
    b = rotation.score_sequence(c, (maize, lentil), p, rules)
    assert a.slot_scores != b.slot_scores
    assert a.score.soil_impact != b.score.soil_impact
    assert a.score.soil_impact > b.score.soil_impact  # N-fixer first leaves better soil
