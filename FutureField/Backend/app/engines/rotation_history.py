"""
FutureField — Rotation History Processing.

Builds an ordered crop sequence from farmer-provided crop history.

Ordering rules:
- Uses actual reported year and start month.
- Supports multiple crops within the same year.
- Supports cultivation periods crossing calendar years.
- Never invents planting dates or crop history.
- Reports ambiguous chronology instead of guessing.
- Preserves compatibility with older crop history records.
"""

from dataclasses import dataclass
from datetime import date

from app.schemas.field import CropHistoryItem


@dataclass
class HistoryResult:
    crop_ids: list[str]
    status: str
    message: str


# --------------------------------------------------
# Legacy Season Ordering
# --------------------------------------------------

# Used only for older records without month information.
# Rabi is excluded because it can cross calendar years.

SEASON_ORDER = {
    "kharif-i": 1,
    "kharif-1": 1,
    "kharif i": 1,
    "pre-kharif": 1,
    "kharif-ii": 2,
    "kharif-2": 2,
    "kharif ii": 2,
    "aman": 2,
}


def _season_rank(season: str) -> int | None:
    normalized = season.strip().lower().replace("_", "-")
    return SEASON_ORDER.get(normalized)


# --------------------------------------------------
# Date Helpers
# --------------------------------------------------

def _start_date(item: CropHistoryItem) -> date | None:
    """
    Returns the reported cultivation start month.

    The first day of the month is used only as a
    sorting key, not as an actual planting date.
    """

    if item.start_month is None:
        return None

    return date(item.year, item.start_month, 1)


def _end_date(item: CropHistoryItem) -> date | None:
    """
    Returns the reported cultivation end month.

    If the end month is earlier than the start month,
    the cultivation period crosses into the next year.
    """

    if item.start_month is None or item.end_month is None:
        return None

    end_year = item.year

    if item.end_month < item.start_month:
        end_year += 1

    return date(end_year, item.end_month, 1)


# --------------------------------------------------
# Main Rotation Extraction
# --------------------------------------------------

def extract_current_rotation(
    crop_history: list[CropHistoryItem],
    n_slots: int = 3,
) -> HistoryResult:

    # --------------------------------------------------
    # Validate History
    # --------------------------------------------------

    if not crop_history:
        return HistoryResult(
            crop_ids=[],
            status="unavailable",
            message=(
                "No crop history is available. "
                "Add crop history to compare current practice."
            ),
        )

    if len(crop_history) < n_slots:
        return HistoryResult(
            crop_ids=[],
            status="insufficient",
            message=(
                f"At least {n_slots} crop history records "
                "are required for this comparison."
            ),
        )

    if any(not item.crop_id.strip() for item in crop_history):
        return HistoryResult(
            crop_ids=[],
            status="insufficient",
            message="Crop history contains an empty crop ID.",
        )

    # --------------------------------------------------
    # Group Records by Year
    # --------------------------------------------------

    by_year: dict[int, list[CropHistoryItem]] = {}

    for item in crop_history:
        by_year.setdefault(item.year, []).append(item)

    ordered: list[CropHistoryItem] = []

    # --------------------------------------------------
    # Sort Records Chronologically
    # --------------------------------------------------

    for year in sorted(by_year):

        records = by_year[year]

        # Only one crop in the year:
        # no same-year ordering ambiguity.
        if len(records) == 1:
            ordered.extend(records)
            continue

        # ----------------------------------------------
        # Preferred: Month-Based Ordering
        # ----------------------------------------------

        if all(item.start_month is not None for item in records):

            starts = [
                _start_date(item)
                for item in records
            ]

            # Two crops with the same reported start month
            # cannot be ordered reliably.
            if len(set(starts)) != len(starts):
                return HistoryResult(
                    crop_ids=[],
                    status="insufficient",
                    message=(
                        f"Multiple crops in {year} share "
                        "the same start month. "
                        "Provide more precise planting "
                        "dates or an explicit crop order."
                    ),
                )

            ordered.extend(
                sorted(
                    records,
                    key=lambda item: item.start_month,
                )
            )

            continue

        # ----------------------------------------------
        # Legacy: Season-Based Ordering
        # ----------------------------------------------

        # Used only when none of the same-year records
        # has start-month information.

        if all(item.start_month is None for item in records):

            ranked = [
                (_season_rank(item.season), item)
                for item in records
            ]

            if any(rank is None for rank, _ in ranked):
                return HistoryResult(
                    crop_ids=[],
                    status="insufficient",
                    message=(
                        f"Multiple crops were reported "
                        f"in {year}, but their chronology "
                        "cannot be determined. "
                        "Add start months to the records."
                    ),
                )

            ranks = [
                rank
                for rank, _ in ranked
            ]

            if len(set(ranks)) != len(ranks):
                return HistoryResult(
                    crop_ids=[],
                    status="insufficient",
                    message=(
                        f"Multiple crops in {year} "
                        "share the same seasonal position. "
                        "Add start months to establish "
                        "their order."
                    ),
                )

            ordered.extend(
                item
                for _, item in sorted(
                    ranked,
                    key=lambda pair: pair[0],
                )
            )

            continue

        # ----------------------------------------------
        # Mixed Month / Legacy Records
        # ----------------------------------------------

        return HistoryResult(
            crop_ids=[],
            status="insufficient",
            message=(
                f"Some crop records in {year} have "
                "start months while others do not. "
                "Add start months to all crops "
                "reported in that year."
            ),
        )

    # --------------------------------------------------
    # Select Most Recent Rotation
    # --------------------------------------------------

    recent = ordered[-n_slots:]

    # --------------------------------------------------
    # Build Result
    # --------------------------------------------------

    return HistoryResult(
        crop_ids=[
            item.crop_id.strip()
            for item in recent
        ],
        status="available",
        message=(
            "Current rotation was derived from "
            "farmer-reported crop history using "
            "cultivation start months where available. "
            "Planting dates have not been independently verified."
        ),
    )