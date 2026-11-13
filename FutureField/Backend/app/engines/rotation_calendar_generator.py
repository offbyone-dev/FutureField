"""Conservative rotation calendar generator."""

from datetime import date, timedelta

from app.engines.season_calendar import verified_planting_options


def next_month(year: int, month: int):
    if month == 12:
        return year + 1, 1

    return year, month + 1


def generate_rotation_calendar(
    sequence,
    start_month: int,
    start_year: int,
) -> list[dict]:

    if not 1 <= start_month <= 12:
        raise ValueError("Invalid planning start month")

    if not 2020 <= start_year <= 2100:
        raise ValueError("Invalid planning start year")

    earliest = date(start_year, start_month, 1)

    result = []

    for index, crop in enumerate(sequence):

        options = verified_planting_options(crop.id)

        duration = getattr(crop, "growth_days", None)

        item = {
            "slot": index + 1,
            "crop_id": crop.id,
            "crop_name": crop.name,
            "status": "not_assessed",
            "verified": False,
            "planting_date": None,
            "estimated_harvest_date": None,
            "season_id": None,
            "reason": "Verified planting windows are unavailable.",
        }

        if not options:

            result.append(item)

            for later_index, later_crop in enumerate(
                sequence[index + 1:],
                index + 2,
            ):

                result.append({
                    "slot": later_index,
                    "crop_id": later_crop.id,
                    "crop_name": later_crop.name,
                    "status": "not_assessed",
                    "verified": False,
                    "planting_date": None,
                    "estimated_harvest_date": None,
                    "season_id": None,
                    "reason": (
                        "Previous crop has no assessed "
                        "planting/harvest schedule."
                    ),
                })

            break

        if (
            not isinstance(duration, int)
            or isinstance(duration, bool)
            or duration <= 0
        ):

            item["reason"] = "Crop growth duration is unavailable."

            result.append(item)

            for later_index, later_crop in enumerate(
                sequence[index + 1:],
                index + 2,
            ):

                result.append({
                    "slot": later_index,
                    "crop_id": later_crop.id,
                    "crop_name": later_crop.name,
                    "status": "not_assessed",
                    "verified": False,
                    "planting_date": None,
                    "estimated_harvest_date": None,
                    "season_id": None,
                    "reason": (
                        "Previous crop harvest date "
                        "cannot be estimated."
                    ),
                })

            break

        year = earliest.year
        month = earliest.month

        choice = None

        for _ in range(25):

            matches = [
                option
                for option in options
                if month in option["planting_months"]
            ]

            if matches:
                choice = sorted(
                    matches,
                    key=lambda option: str(
                        option.get("season_id")
                    ),
                )[0]

                break

            year, month = next_month(year, month)

        if choice is None:

            item["reason"] = (
                "No verified planting window "
                "found within the planning horizon."
            )

            result.append(item)

            for later_index, later_crop in enumerate(
                sequence[index + 1:],
                index + 2,
            ):
                result.append({
                    "slot": later_index,
                    "crop_id": later_crop.id,
                    "crop_name": later_crop.name,
                    "status": "not_assessed",
                    "verified": False,
                    "planting_date": None,
                    "estimated_harvest_date": None,
                    "season_id": None,
                    "reason": "Previous crop could not be scheduled.",
                })

            break

        planted = date(year, month, 1)

        harvest = planted + timedelta(days=duration)

        item.update({
            "status": "proposed",
            "verified": False,
            "planting_date": planted.isoformat(),
            "estimated_harvest_date": harvest.isoformat(),
            "season_id": choice.get("season_id"),
            "reason": (
                "Planting month matches a verified calendar "
                "window. The first day is a computational "
                "placeholder. Harvest is estimated using "
                "crop growth duration."
            ),
        })

        result.append(item)

        next_year, next_month_number = next_month(
            harvest.year,
            harvest.month,
        )

        earliest = date(
            next_year,
            next_month_number,
            1,
        )

    return result