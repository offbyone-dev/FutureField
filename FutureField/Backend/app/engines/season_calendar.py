"""FutureField — Bangladesh Crop Season Calendar.

Read Bangladesh-specific planting windows and distinguish
verified information from unavailable or provisional data.

Missing calendar information must never be treated as
verified planting compatibility.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


CALENDAR_PATH = (
    Path(__file__).resolve().parents[1]
    / "knowledge"
    / "bangladesh_crop_calendar.json"
)


@lru_cache(maxsize=1)
def load_calendar() -> dict[str, Any]:
    if not CALENDAR_PATH.exists():
        return {
            "country": "Bangladesh",
            "crops": {},
        }

    with CALENDAR_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def valid_month(month: int) -> bool:
    return (
        isinstance(month, int)
        and not isinstance(month, bool)
        and 1 <= month <= 12
    )


def get_crop_calendar_options(crop_id: str) -> list[dict[str, Any]]:
    """Return documented crop calendar options.

    Only variants with a source, verified flag, and valid
    planting months are marked verified.
    """
    crop_data = load_calendar().get("crops", {}).get(crop_id, {})
    variants = crop_data.get("variants", [])

    options = []

    for variant in variants:
        months = variant.get("planting_months")

        valid_window = (
            isinstance(months, list)
            and len(months) > 0
            and all(valid_month(month) for month in months)
        )

        verified = (
            variant.get("verified") is True
            and bool(variant.get("source"))
            and valid_window
        )

        options.append({
            "season_id": variant.get("season_id"),
            "name": variant.get("name"),
            "planting_months": months if valid_window else [],
            "source": variant.get("source"),
            "verified": verified,
        })

    return options


def check_crop_season(
    crop_id: str,
    month: int,
) -> dict[str, Any]:
    """Check a crop's documented planting window."""

    if not valid_month(month):
        raise ValueError("Month must be an integer between 1 and 12.")

    calendar = load_calendar()
    crop_data = calendar.get("crops", {}).get(crop_id)

    if not crop_data:
        return {
            "crop_id": crop_id,
            "month": month,
            "compatible": None,
            "status": "not_assessed",
            "reason": "No Bangladesh planting calendar is available.",
            "matching_seasons": [],
        }

    variants = crop_data.get("variants", [])

    verified_variants = [
        variant
        for variant in variants
        if (
            variant.get("verified") is True
            and variant.get("source")
            and isinstance(variant.get("planting_months"), list)
            and len(variant["planting_months"]) > 0
            and all(
                valid_month(month)
                for month in variant["planting_months"]
            )
        )
    ]

    if not verified_variants:
        return {
            "crop_id": crop_id,
            "month": month,
            "compatible": None,
            "status": "not_assessed",
            "reason": "Verified planting windows are not available.",
            "matching_seasons": [],
        }

    matching = [
        {
            "season_id": variant.get("season_id"),
            "name": variant.get("name"),
            "source": variant.get("source"),
        }
        for variant in verified_variants
        if month in variant["planting_months"]
    ]

    if matching:
        return {
            "crop_id": crop_id,
            "month": month,
            "compatible": True,
            "status": "compatible",
            "reason": "Month matches a documented planting window.",
            "matching_seasons": matching,
        }

    if len(verified_variants) != len(variants):
        return {
            "crop_id": crop_id,
            "month": month,
            "compatible": None,
            "status": "not_assessed",
            "reason": (
                "Some crop-season variants lack verified calendar data."
            ),
            "matching_seasons": [],
        }

    return {
        "crop_id": crop_id,
        "month": month,
        "compatible": False,
        "status": "outside_planting_window",
        "reason": "Month is outside all documented planting windows.",
        "matching_seasons": [],
    }


def check_crop_activity(
    crop_id: str,
    month: int,
    activity: str,
) -> dict[str, Any]:
    """Check a specific crop activity against verified calendar data."""

    activity_fields = {
        "nursery": "nursery_months",
        "direct_seeding": "direct_seeding_months",
        "transplanting": "transplanting_months",
    }

    if activity not in activity_fields:
        raise ValueError(
            "Activity must be nursery, direct_seeding or transplanting."
        )

    if not valid_month(month):
        raise ValueError("Month must be between 1 and 12.")

    crop_data = load_calendar().get("crops", {}).get(crop_id)

    if not crop_data:
        return {
            "crop_id": crop_id,
            "month": month,
            "activity": activity,
            "compatible": None,
            "status": "not_assessed",
            "reason": "No crop calendar available.",
            "matching_seasons": [],
        }

    field = activity_fields[activity]
    variants = crop_data.get("variants", [])

    verified = [
        variant
        for variant in variants
        if (
            variant.get("verified") is True
            and variant.get("source")
            and isinstance(variant.get(field), list)
            and len(variant[field]) > 0
            and all(valid_month(month) for month in variant[field])
        )
    ]

    if not verified:
        return {
            "crop_id": crop_id,
            "month": month,
            "activity": activity,
            "compatible": None,
            "status": "not_assessed",
            "reason": (
                "Verified activity-specific calendar data is unavailable."
            ),
            "matching_seasons": [],
        }

    matching = [
        {
            "season_id": variant.get("season_id"),
            "name": variant.get("name"),
            "source": variant.get("source"),
        }
        for variant in verified
        if month in variant[field]
    ]

    if matching:
        return {
            "crop_id": crop_id,
            "month": month,
            "activity": activity,
            "compatible": True,
            "status": "compatible",
            "reason": "Month matches a verified activity window.",
            "matching_seasons": matching,
        }

    if len(verified) != len(variants):
        return {
            "crop_id": crop_id,
            "month": month,
            "activity": activity,
            "compatible": None,
            "status": "not_assessed",
            "reason": "Some seasonal activity windows are unverified.",
            "matching_seasons": [],
        }

    return {
        "crop_id": crop_id,
        "month": month,
        "activity": activity,
        "compatible": False,
        "status": "outside_planting_window",
        "reason": "Month is outside verified activity windows.",
        "matching_seasons": [],
    }