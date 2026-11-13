"""Plan vs actual comparison."""
from app.schemas.plan import FarmPlan, OutcomeCreate


def compare_plan_vs_actual(plan: FarmPlan, outcome: OutcomeCreate) -> dict:
    """TODO(inside): compare actual yield with a predicted yield band (needs yield estimate
    from crop.yield_index), list likely causes from outcome.issues vs plan flags."""
    planned = plan.rotation.crop_ids
    matches = [i < len(outcome.actual_crops) and outcome.actual_crops[i] == c for i, c in enumerate(planned)]
    return {"planned_crops": planned, "actual_crops": outcome.actual_crops,
            "crop_match_per_slot": matches,
            "summary": f"{sum(matches)} of {len(planned)} planned slots followed the plan."}
