"""Run the whole pipeline in the terminal and print each stage:  python -m app.demo"""
from app.schemas.analysis import Priorities, RotationRequest, SimulationParams, SimulationRequest, SuitabilityRequest
from app.services import (environment_service, intelligence_service, rotation_service,
                          simulation_service, suitability_service)
from app.storage.seed import seed_demo_fields


def main(field_id: str = "demo-1") -> None:
    seed_demo_fields()
    env = environment_service.get_environment(field_id)
    print(f"\n[1] ENVIRONMENT  source={env.source} quality={env.quality_score}\n    {env.indicators}")
    cond = intelligence_service.get_intelligence(field_id)
    print(f"\n[2] FIELD INTELLIGENCE flags={cond.flags} confidence={cond.confidence}")
    print(f"    water={cond.water_score:.2f} heat={cond.heat_score:.2f} soil={cond.soil_score:.2f}")
    pr = Priorities(water=0.8)
    suit = suitability_service.run_suitability(field_id, SuitabilityRequest(priorities=pr))
    print("\n[3] SUITABILITY (water priority 0.8)")
    for r in suit.results:
        tag = "" if r.recommended else f"  NOT RECOMMENDED: {r.not_recommended_reason}"
        print(f"    {r.crop_name:8s} {r.total_score:6.2f}{tag}")
    rot = rotation_service.run_rotations(field_id, RotationRequest(priorities=pr, limit=3))
    print("\n[4] TOP ROTATIONS")
    for s in rot.rotations:
        print(f"    {' -> '.join(s.crop_names)}  total={s.score.total}")
    sim = simulation_service.run_simulation(
        field_id, SimulationRequest(params=SimulationParams(rainfall_pct=-30, temperature_delta_c=2), priorities=pr))
    print("\n[5] SCENARIO: rainfall -30%, +2C")
    for d in sim.crop_deltas:
        print(f"    {d.crop_name:8s} {d.baseline_score:6.2f} -> {d.simulated_score:6.2f}  ({d.score_delta:+.2f}) risk={d.new_risk}")
    print(f"    top rotation changed: {sim.top_rotation_changed}\n")


if __name__ == "__main__":
    main()
