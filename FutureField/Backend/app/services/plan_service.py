"""Chosen rotation -> FarmPlan with crop calendar.

Sowing window assumptions (Bangladesh agricultural calendar):
- Rice (Aman, rainfed): June 20 (BRRI recommended transplanting window)
- Wheat (Rabi): November 20 (BWMRI recommended sowing date)
- Lentil (Rabi): November 1 (BARI recommended sowing)
- Maize (Kharif-1): March 15 (BARI recommended sowing)
- Mustard (Rabi): October 25 (BARI recommended sowing)

Sources: BARC/DAE Crop Calendar; BRRI rice calendar; BARI crop-specific recommendations.

Limitation: The Bangladesh cropping calendar is highly localised (coastal, haor, barind).
The windows above are simplified national averages. Actual sowing depends on local weather,
field readiness, and the specific variety chosen.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from app.errors import InvalidInputError, NotFoundError
from app.knowledge.loader import crops_by_id
from app.schemas.plan import CalendarEntry, FarmPlan, PlanRequest
from app.services import field_service
from app.storage import json_store

SOWING_WINDOW_DAYS = 7
HARVEST_WINDOW_DAYS = 7
FALLOW_DAYS = 14

# Bangladesh agronomic calendar: crop_id -> (preferred_month, preferred_day)
# Source: BARC/DAE crop calendar; BRRI rice calendar; BARI recommendations.
CROP_PREFERRED_SOWING: dict[str, tuple[int, int]] = {
    "rice":    (6, 20),   # Aman season (June 20 central estimate)
    "wheat":   (11, 20),  # Rabi (November 20)
    "lentil":  (11, 1),   # Rabi (November 1)
    "maize":   (3, 15),   # Kharif-1 (March 15)
    "mustard": (10, 25),  # Rabi (October 25)
}

KEY_ACTIONS_BY_CROP: dict[str, list[str]] = {
    "rice": [
        "Prepare nursery bed",
        "Transplant seedlings (25–30 days old)",
        "Maintain 2–5 cm standing water",
        "Apply split fertilizer (basal + topdress at tillering)",
        "Drain field 10 days before harvest",
        "Harvest at 85% grain maturity",
    ],
    "wheat": [
        "Prepare fine seedbed (2–3 ploughings)",
        "Sow seed in lines (20 cm row spacing)",
        "Apply basal fertilizer (NPK)",
        "First irrigation at crown root initiation (21 DAS)",
        "Apply nitrogen top-dressing at tillering",
        "Harvest when grains turn golden-yellow",
    ],
    "lentil": [
        "Prepare field with shallow tillage",
        "Sow seed by broadcasting or line sowing",
        "Thin to 5 cm plant spacing at 10–12 DAS",
        "Apply phosphate and sulphur fertilizer",
        "Scout for aphids and pod borer",
        "Harvest when 80% of pods mature",
    ],
    "maize": [
        "Deep ploughing and seedbed preparation",
        "Sow 2 seeds per hill (thin to 1 plant at 7–10 DAS)",
        "Apply NPK fertilizer (split doses)",
        "First irrigation at knee-high stage",
        "De-tassel if using hybrid seed",
        "Harvest at physiological maturity (black layer)",
    ],
    "mustard": [
        "Prepare fine seedbed",
        "Broadcast seed mixed with dry sand (1:3 ratio)",
        "Thin seedlings at 10 days (5–7 cm spacing)",
        "Apply sulphur and boron fertilizer",
        "Scout for aphid and alternaria blight",
        "Harvest at 80% pod maturity (avoid shattering)",
    ],
}

DEFAULT_KEY_ACTIONS = ["Prepare field", "Sow / transplant", "Monitor water and pests",
                       "Apply fertilizer as needed", "Harvest at maturity"]


def _preferred_sowing_start(crop_id: str, reference_date: date) -> date:
    """Return the nearest upcoming preferred sowing date for a crop.

    If the preferred month/day has already passed this year, the next year's
    occurrence is returned. Falls back to reference_date for unknown crops.
    """
    pref = CROP_PREFERRED_SOWING.get(crop_id)
    if pref is None:
        return reference_date
    month, day = pref
    try:
        candidate = reference_date.replace(month=month, day=day)
    except ValueError:
        # Handles edge cases like Feb 29 in non-leap years
        candidate = reference_date.replace(month=month, day=28)
    if candidate < reference_date:
        try:
            candidate = candidate.replace(year=reference_date.year + 1)
        except ValueError:
            candidate = candidate.replace(year=reference_date.year + 1, day=28)
    return candidate


def build_plan(field_id: str, req: PlanRequest) -> FarmPlan:
    """Build a FarmPlan from a chosen RotationScenario.

    When start_date is provided, slots are scheduled from that date forward,
    chaining harvest -> fallow -> sowing.

    When start_date is omitted and a preferred sowing window exists for the first
    crop in the rotation, the plan aligns with the Bangladesh agronomic calendar.
    Otherwise today's date is used as the starting point.
    """
    field_service.get_field(field_id)  # raises 404 if missing
    by_id = crops_by_id()
    calendar: list[CalendarEntry] = []

    # Determine the starting date
    first_crop_id = req.rotation.crop_ids[0] if req.rotation.crop_ids else None
    if req.start_date:
        cursor = req.start_date
    elif first_crop_id and first_crop_id in CROP_PREFERRED_SOWING:
        cursor = _preferred_sowing_start(first_crop_id, date.today())
    else:
        cursor = date.today()

    for slot, crop_id in enumerate(req.rotation.crop_ids, start=1):
        crop = by_id.get(crop_id)
        if crop is None:
            raise InvalidInputError(f"Unknown crop '{crop_id}'")
        s0 = cursor
        s1 = s0 + timedelta(days=SOWING_WINDOW_DAYS)
        h0 = s0 + timedelta(days=crop.growth_days)
        h1 = h0 + timedelta(days=HARVEST_WINDOW_DAYS)
        calendar.append(CalendarEntry(
            slot=slot,
            crop_id=crop.id,
            crop_name=crop.name,
            sowing_start=s0,
            sowing_end=s1,
            harvest_start=h0,
            harvest_end=h1,
            key_actions=KEY_ACTIONS_BY_CROP.get(crop_id, DEFAULT_KEY_ACTIONS),
        ))
        cursor = h1 + timedelta(days=FALLOW_DAYS)

    assumptions = [
        "Rule-based recommendation; crop parameters from crops.json (BARC/FAO sources).",
        "Sowing windows follow simplified Bangladesh agronomic calendar (BARC/DAE).",
        "Indicator data may be from NASA mock provider (see data_source in /environment).",
        "Actual sowing dates depend on local weather, variety choice, and field readiness.",
    ]

    plan = FarmPlan(
        id=uuid.uuid4().hex[:8],
        field_id=field_id,
        rotation=req.rotation,
        calendar=calendar,
        assumptions=assumptions,
        scenario_used=req.scenario_used,
        created_at=datetime.now(timezone.utc),
    )
    json_store.save("plans", plan.id, plan.model_dump(mode="json"))
    return plan


def get_plan(plan_id: str) -> FarmPlan:
    raw = json_store.load("plans", plan_id)
    if raw is None:
        raise NotFoundError(f"Plan '{plan_id}' not found")
    return FarmPlan(**raw)
