from datetime import datetime, timezone

from app.engines import outcome
from app.schemas.plan import OutcomeCreate, SeasonOutcome
from app.services import plan_service
from app.storage import json_store


def save_outcome(plan_id: str, body: OutcomeCreate) -> SeasonOutcome:
    plan = plan_service.get_plan(plan_id)
    result = SeasonOutcome(**body.model_dump(), plan_id=plan_id,
                           comparison=outcome.compare_plan_vs_actual(plan, body),
                           saved_at=datetime.now(timezone.utc))
    json_store.save("outcomes", plan_id, result.model_dump(mode="json"))
    return result
