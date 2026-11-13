"""

FutureField — NASA Data Source Registry

Data priority:

1. Valid versioned cache

2. NASA POWER meteorology

3. NASA MODIS NDVI

4. NASA POWER MERRA-2 soil data

5. NASA POWER MERRA-2 precipitation data

6. Explicit mock fallback when no usable NASA data exists

Important:

- Missing NASA observations are NEVER silently replaced with mock values.

- Observations are aligned by date.

- Cached results are separated by processing version.

- Source labels describe the actual type of data returned.

- Real observations remain real even when some dates are missing.

"""

import logging

import math

from datetime import date, timedelta

from app import config

from app.data_sources import cache

from app.data_sources.base import DailySeries, FILL_VALUE

from app.data_sources.mock_provider import MockProvider

from app.data_sources.nasa_power import NasaPowerClient

from app.data_sources.nasa_vegetation import NasaVegetationClient

from app.data_sources.nasa_soil_moisture import NasaSoilMoistureClient

from app.data_sources.nasa_precipitation import NasaPrecipitationClient

log = logging.getLogger(__name__)

# New cache namespace prevents old mock-filled results

# from being reused after the provenance fix.

CACHE_DATASET = "series_provenance_v2"

CORE_KEYS = (

    "tmax",

    "tmin",

    "rain",

    "ndvi",

    "soil_moisture",

)

POWER_KEYS = (

    "tmax",

    "tmin",

    "rain",

    "soil_moisture",

    "rh",

)

SOIL_KEYS = (

    "soil_moisture",

    "soil_top",

    "soil_profile",

)

PRECIP_KEYS = (

    "rain",

    "humidity_g_kg",

    "cool_degree_days",

)

# ---------------------------------------------------------

# Missing-value helpers

# ---------------------------------------------------------

def _is_missing(value) -> bool:

    """Identify missing or invalid numeric observations."""

    if value is None:

        return True

    try:

        number = float(value)

        return (

            not math.isfinite(number)

            or number == FILL_VALUE

            or number <= -999

        )

    except (TypeError, ValueError):

        return True

def _has_valid_data(

    series: DailySeries,

    keys: tuple[str, ...],

) -> bool:

    """Check whether any requested variable has observations."""

    for key in keys:

        values = series.get(key, [])

        if any(

            not _is_missing(value)

            for value in values

        ):

            return True

    return False

def _create_empty_series(

    start: date,

    end: date,

) -> DailySeries:

    """Create an aligned date range without synthetic values."""

    total_days = (end - start).days + 1

    dates = [

        (start + timedelta(days=i)).isoformat()

        for i in range(total_days)

    ]

    series: DailySeries = {

        "dates": dates,

    }

    for key in CORE_KEYS:

        series[key] = [FILL_VALUE] * total_days

    return series

# ---------------------------------------------------------

# Safe NASA overlay

# ---------------------------------------------------------

def _overlay(

    base: DailySeries,

    extra: DailySeries,

    keys: tuple[str, ...],

    replace_existing: bool = False,

) -> DailySeries:

    """

    Merge NASA observations using exact date matching.

    By default, valid existing observations are preserved.

    Missing incoming values never overwrite valid data.

    """

    if not extra or "dates" not in extra:

        return base

    base_dates = base.get("dates", [])

    extra_dates = extra.get("dates", [])

    date_index = {

        day: index

        for index, day in enumerate(extra_dates)

    }

    for key in keys:

        if key not in extra:

            continue

        incoming_values = extra[key]

        existing_values = list(

            base.get(

                key,

                [FILL_VALUE] * len(base_dates),

            )

        )

        aligned = []

        for i, day in enumerate(base_dates):

            current = (

                existing_values[i]

                if i < len(existing_values)

                else FILL_VALUE

            )

            extra_index = date_index.get(day)

            if (

                extra_index is None

                or extra_index >= len(incoming_values)

            ):

                aligned.append(current)

                continue

            incoming = incoming_values[extra_index]

            if _is_missing(incoming):

                aligned.append(current)

                continue

            if replace_existing or _is_missing(current):

                aligned.append(incoming)

            else:

                aligned.append(current)

        base[key] = aligned

    return base

# ---------------------------------------------------------

# Cache helpers

# ---------------------------------------------------------

def _get_cache(

    field_id: str,

    lat: float,

    lon: float,

    start: date,

    end: date,

):

    return cache.cache_get(

        field_id,

        CACHE_DATASET,

        lat,

        lon,

        start,

        end,

    )

def _save_cache(

    field_id: str,

    lat: float,

    lon: float,

    start: date,

    end: date,

    series: DailySeries,

    source: str,

    sources: list[str],

) -> None:

    cache.cache_put(

        field_id,

        CACHE_DATASET,

        lat,

        lon,

        start,

        end,

        series,

        source,

        sources,

    )

# ---------------------------------------------------------

# Main NASA registry

# ---------------------------------------------------------

def fetch_with_fallback(

    field_id: str,

    lat: float,

    lon: float,

    start: date,

    end: date,

    refresh: bool = False,

) -> tuple[DailySeries, str, list[str]]:

    """

    Return environmental data for a selected field.

    Source classifications:

    real:

        Returned observations come from NASA sources.

        Some dates or variables may still be missing.

    mock:

        All returned observations are synthetic.

    partial:

        Reserved for mixed real/synthetic datasets.

        This implementation does not mix the two.

    Missing NASA values remain FILL_VALUE until cleaning.

    """

    if end < start:

        raise ValueError(

            "End date cannot be earlier than start date."

        )

    if not (-90 <= lat <= 90):

        raise ValueError("Invalid latitude.")

    if not (-180 <= lon <= 180):

        raise ValueError("Invalid longitude.")

    # -----------------------------------------------------

    # 1. Explicit mock mode

    # -----------------------------------------------------

    if config.USE_MOCK_NASA:

        if not refresh:

            cached = _get_cache(

                field_id,

                lat,

                lon,

                start,

                end,

            )

            if cached and cached.get("source") == "mock":

                return (

                    cached["series"],

                    "mock",

                    cached.get("sources", ["MockProvider"]),

                )

        mock_series = MockProvider().get_series(

            lat,

            lon,

            start,

            end,

        )

        sources = ["MockProvider (synthetic data)"]

        _save_cache(

            field_id,

            lat,

            lon,

            start,

            end,

            mock_series,

            "mock",

            sources,

        )

        return mock_series, "mock", sources

    # -----------------------------------------------------

    # 2. Versioned cache

    # -----------------------------------------------------

    if not refresh:

        cached = _get_cache(

            field_id,

            lat,

            lon,

            start,

            end,

        )

        if cached and cached.get("source") == "real":
            cached_series = cached.get("series") or {}

            if _has_valid_data(cached_series, ("ndvi",)):
                log.info("NASA cache hit for field %s", field_id)
                return (
                    cached_series,
                    "real",
                    cached.get("sources", []),
                )

            # Real POWER data may have been cached without MODIS NDVI.
            # Retry NASA instead of indefinitely reusing that cache.
            log.info(
                "Cached NDVI missing for field %s; retrying NASA sources",
                field_id,
            )

    # -----------------------------------------------------
    # -----------------------------------------------------

    # 3. Initialize empty real-data series

    # -----------------------------------------------------

    series = _create_empty_series(start, end)

    sources: list[str] = []

    # -----------------------------------------------------

    # 4. NASA POWER

    # -----------------------------------------------------

    try:

        power_series = NasaPowerClient().get_series(

            lat,

            lon,

            start,

            end,

        )

        if _has_valid_data(

            power_series,

            POWER_KEYS,

        ):

            series = _overlay(

                series,

                power_series,

                POWER_KEYS,

            )

            sources.append(

                "NASA POWER (meteorology)"

            )

            log.info(

                "NASA POWER data loaded: %s",

                field_id,

            )

    except Exception as exc:

        log.warning(

            "NASA POWER failed for %s: %s",

            field_id,

            exc,

        )

    # -----------------------------------------------------

    # 5. NASA MODIS NDVI

    # -----------------------------------------------------

    try:

        # A shorter MODIS request was verified to work for this field.
        # Large seasonal requests may fail or return no usable samples.
        # Try the complete range first; if it fails, retry in overlapping
        # 90-day windows. Overlap preserves interpolation at boundaries.
        vegetation_client = NasaVegetationClient()
        try:
            vegetation_series = vegetation_client.get_series(
                lat, lon, start, end
            )
        except Exception as full_range_error:
            log.warning(
                "MODIS full-range request failed for %s (%s to %s): %s; "
                "trying shorter windows",
                field_id, start, end, full_range_error,
            )
            vegetation_series = _create_empty_series(start, end)
            window_start = start
            successful_windows = 0
            while window_start <= end:
                window_end = min(window_start + timedelta(days=89), end)
                try:
                    window_series = vegetation_client.get_series(
                        lat, lon, window_start, window_end
                    )
                    if _has_valid_data(window_series, ("ndvi",)):
                        vegetation_series = _overlay(
                            vegetation_series, window_series, ("ndvi",)
                        )
                        successful_windows += 1
                except Exception as window_error:
                    log.warning(
                        "MODIS window unavailable for %s (%s to %s): %s",
                        field_id, window_start, window_end, window_error,
                    )
                if window_end == end:
                    break
                # 20-day overlap accommodates the 16-day composite interval.
                window_start = window_end - timedelta(days=19)
            if successful_windows == 0:
                raise ValueError(
                    "No usable MODIS NDVI in full range or shorter windows"
                ) from full_range_error

        if _has_valid_data(

            vegetation_series,

            ("ndvi",),

        ):

            series = _overlay(

                series,

                vegetation_series,

                ("ndvi",),

            )

            sources.append(

                "NASA MODIS NDVI (ORNL DAAC)"

            )

            log.info(

                "NASA vegetation data loaded: %s",

                field_id,

            )

    except Exception as exc:

        log.warning(

            "NASA vegetation unavailable for %s: %s",

            field_id,

            exc,

        )

    # -----------------------------------------------------

    # 6. NASA soil data

    # -----------------------------------------------------

    try:

        soil_series = (

            NasaSoilMoistureClient().get_series(

                lat,

                lon,

                start,

                end,

            )

        )

        if _has_valid_data(

            soil_series,

            SOIL_KEYS,

        ):

            series = _overlay(

                series,

                soil_series,

                SOIL_KEYS,

            )

            sources.append(

                "NASA POWER MERRA-2 soil wetness"

            )

            log.info(

                "NASA soil data loaded: %s",

                field_id,

            )

    except Exception as exc:

        log.warning(

            "NASA soil data unavailable for %s: %s",

            field_id,

            exc,

        )

    # -----------------------------------------------------

    # 7. NASA precipitation

    # -----------------------------------------------------

    try:

        precipitation_series = (

            NasaPrecipitationClient().get_series(

                lat,

                lon,

                start,

                end,

            )

        )

        if _has_valid_data(

            precipitation_series,

            PRECIP_KEYS,

        ):

            # Existing POWER rainfall stays authoritative.

            # Secondary precipitation fills missing dates.

            series = _overlay(

                series,

                precipitation_series,

                PRECIP_KEYS,

            )

            sources.append(

                "NASA POWER MERRA-2 precipitation"

            )

            log.info(

                "NASA precipitation loaded: %s",

                field_id,

            )

    except Exception as exc:

        log.warning(

            "NASA precipitation unavailable for %s: %s",

            field_id,

            exc,

        )

    # -----------------------------------------------------

    # 8. Check whether NASA returned usable data

    # -----------------------------------------------------

    has_real_data = _has_valid_data(

        series,

        CORE_KEYS,

    )

    # -----------------------------------------------------

    # 9. Full mock fallback

    # -----------------------------------------------------

    if not has_real_data:

        log.warning(

            "No usable NASA observations for field %s. "

            "Using explicitly labelled synthetic fallback.",

            field_id,

        )

        mock_series = MockProvider().get_series(

            lat,

            lon,

            start,

            end,

        )

        sources = [

            "MockProvider (synthetic fallback; "

            "NASA observations unavailable)"

        ]

        # Do not cache this fallback in real mode.

        # A later request should be able to retry NASA.

        return mock_series, "mock", sources

    # -----------------------------------------------------

    # 10. Real source classification

    # -----------------------------------------------------

    source_flag = "real"

    # Missing individual observations are intentionally

    # preserved. The cleaning layer will calculate coverage.

    # -----------------------------------------------------

    # 11. Cache NASA observations

    # -----------------------------------------------------

    _save_cache(

        field_id,

        lat,

        lon,

        start,

        end,

        series,

        source_flag,

        sources,

    )

    log.info(

        "NASA registry completed: field=%s source=%s",

        field_id,

        source_flag,

    )

    return series, source_flag, sources
