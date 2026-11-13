"""Runs the SAME services twice (baseline vs simulated) and diffs them."""
from app.engines import simulation
from app.schemas.analysis import (RotationRequest, SimulationRequest, SimulationResult, SuitabilityRequest)
from app.services import rotation_service, suitability_service


def run_simulation(field_id: str, req: SimulationRequest) -> SimulationResult:
    base = suitability_service.run_suitability(field_id, SuitabilityRequest(priorities=req.priorities))
    sim = suitability_service.run_suitability(
        field_id, SuitabilityRequest(priorities=req.priorities, simulation=req.params))
    base_rot, sim_rot, changed = [], [], False
    if req.include_rotations:
        base_rot = rotation_service.run_rotations(field_id, RotationRequest(priorities=req.priorities)).rotations
        sim_rot = rotation_service.run_rotations(
            field_id, RotationRequest(priorities=req.priorities, simulation=req.params)).rotations
        changed = bool(base_rot and sim_rot and base_rot[0].crop_ids != sim_rot[0].crop_ids)
    return SimulationResult(
        field_id=field_id, params=req.params, baseline=base.results, simulated=sim.results,
        crop_deltas=simulation.compare_suitability(base.results, sim.results),
        baseline_rotations=base_rot, simulated_rotations=sim_rot,
        top_rotation_changed=changed, limitation=simulation.LIMITATION)
