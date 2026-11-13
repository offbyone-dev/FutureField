"""Doc steps 1-3 + 7: score all crops, pick top N, hand to the rotation engine."""
from app.engines import rotation, suitability
from app.knowledge.loader import crops_by_id, load_crops, load_rotation_rules
from app.schemas.analysis import RotationRequest, RotationResponse
from app.services import pipeline


def run_rotations(field_id: str, req: RotationRequest) -> RotationResponse:
    _, env, cond = pipeline.build_condition(field_id, req.simulation)
    ranked = suitability.rank_crops(cond, load_crops(), req.priorities)
    by_id = crops_by_id()
    candidates = [by_id[r.crop_id] for r in ranked if r.recommended][:req.top_n]
    rotations = rotation.rank_rotations(cond, candidates, req.priorities, load_rotation_rules(),
                                        n_slots=req.n_slots, limit=req.limit)
    return RotationResponse(field_id=field_id, rotations=rotations, data_quality=env.quality_score,
                            data_source=env.source, simulated=req.simulation is not None)
