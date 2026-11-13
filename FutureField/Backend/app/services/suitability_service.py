from app.engines import suitability
from app.knowledge.loader import load_crops
from app.schemas.analysis import SuitabilityRequest, SuitabilityResponse
from app.services import pipeline


def run_suitability(field_id: str, req: SuitabilityRequest) -> SuitabilityResponse:
    _, env, cond = pipeline.build_condition(field_id, req.simulation)
    ranked = suitability.rank_crops(cond, load_crops(), req.priorities)
    return SuitabilityResponse(field_id=field_id, results=ranked, data_quality=env.quality_score,
                               data_source=env.source, simulated=req.simulation is not None)
