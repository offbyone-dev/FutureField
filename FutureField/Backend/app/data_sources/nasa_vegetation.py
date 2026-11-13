"""
NASA MODIS NDVI client.

Source:
NASA ORNL DAAC MODIS subset service.

Product:
MOD13Q1, 250 m, 16-day vegetation index.

Important:
- NDVI observations are not daily satellite measurements.
- Interpolation is used only between valid observations.
- Dates outside the observed range remain missing.
"""

from datetime import date, timedelta
import math

import httpx

from app import config
from app.data_sources.base import (
    FILL_VALUE,
    DailySeries,
    DataSource,
)


ORNL_URL = "https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset"

NDVI_SCALE = 0.0001


def _modis_date(day: date) -> str:
    return f"A{day.year}{day.timetuple().tm_yday:03d}"


def _valid_ndvi(value: object) -> float | None:
    try:
        raw = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(raw):
        return None

    # MOD13Q1 NDVI valid raw range.
    if raw < -2000 or raw > 10000:
        return None

    return raw * NDVI_SCALE


def _to_daily(
    start: date,
    end: date,
    samples: list[tuple[date, float]],
) -> list[float]:

    total_days = (end - start).days + 1

    if not samples:
        return [FILL_VALUE] * total_days

    # Remove duplicate observation dates.
    unique = {
        observation_date: value
        for observation_date, value in samples
    }

    observations = sorted(unique.items())

    output: list[float] = []

    index = 0

    for offset in range(total_days):

        current_date = start + timedelta(days=offset)

        # Never extrapolate outside observed dates.
        if (
            current_date < observations[0][0]
            or current_date > observations[-1][0]
        ):
            output.append(FILL_VALUE)
            continue

        while (
            index + 1 < len(observations)
            and observations[index + 1][0] <= current_date
        ):
            index += 1

        left_date, left_value = observations[index]

        if current_date == left_date:
            output.append(left_value)
            continue

        if index + 1 >= len(observations):
            output.append(FILL_VALUE)
            continue

        right_date, right_value = observations[index + 1]

        gap_days = (right_date - left_date).days

        if gap_days <= 0:
            output.append(FILL_VALUE)
            continue

        # Avoid interpolation across unusually large gaps.
        if gap_days > 32:
            output.append(FILL_VALUE)
            continue

        ratio = (
            (current_date - left_date).days / gap_days
        )

        interpolated = (
            left_value
            + ratio * (right_value - left_value)
        )

        output.append(round(interpolated, 6))

    return output


class NasaVegetationClient(DataSource):

    name = "nasa_modis_ndvi"

    def get_series(
        self,
        lat: float,
        lon: float,
        start: date,
        end: date,
    ) -> DailySeries:

        params = {
            "latitude": lat,
            "longitude": lon,
            "band": "250m_16_days_NDVI",
            "startDate": _modis_date(start),
            "endDate": _modis_date(end),
            "kmAboveBelow": 0,
            "kmLeftRight": 0,
        }

        response = httpx.get(
            ORNL_URL,
            params=params,
            timeout=config.NASA_TIMEOUT_S,
            headers={
                "Accept": "application/json",
            },
        )

        response.raise_for_status()

        payload = response.json()

        subset = payload.get("subset") or []

        samples: list[tuple[date, float]] = []

        for row in subset:

            values = row.get("data") or []

            if not values:
                continue

            value = _valid_ndvi(values[0])

            if value is None:
                continue

            calendar_date = row.get("calendar_date")

            if not calendar_date:
                continue

            try:
                observation_date = date.fromisoformat(
                    calendar_date[:10]
                )
            except ValueError:
                continue

            samples.append(
                (observation_date, value)
            )

        total_days = (end - start).days + 1

        dates = [
            (start + timedelta(days=i)).isoformat()
            for i in range(total_days)
        ]

        ndvi = _to_daily(
            start,
            end,
            samples,
        )

        if all(value == FILL_VALUE for value in ndvi):
            raise ValueError(
                "MODIS NDVI returned no usable observations "
                "for the requested date range."
            )

        return {
            "dates": dates,
            "ndvi": ndvi,
        }