"""
FutureField — Personal Environmental Data Service

Fetches real NASA environmental data for authenticated
Supabase fields.

Features:
- Supabase JWT authentication
- Field ownership verification
- Field-specific NASA data
- Location-aware caching
- Date-range-aware caching
- Force refresh support
- Environmental indicators
- Data quality scoring
- Real / Partial / Mock source tracking
- Temporary NDVI diagnostics
"""

from datetime import date, datetime, timedelta, timezone

from app import config
from app.data_sources import registry
from app.processing import (
    aggregation,
    cleaning,
    indicators,
    normalization,
)
from app.schemas.environment import EnvironmentalData
from app.services import supabase_field_service


def get_personal_environment(
    field_id: str,
    token: str,
    user_id: str,
    refresh: bool = False,
) -> EnvironmentalData:
    """
    Get environmental data for an authenticated user's field.

    Flow:
    1. Verify field ownership in Supabase.
    2. Read the field's latitude and longitude.
    3. Fetch NASA observations.
    4. Clean and process environmental data.
    5. Calculate indicators.
    6. Return environmental analysis.
    """

    # --------------------------------------------------------
    # 1. Verify Field Ownership
    # --------------------------------------------------------

    field = supabase_field_service.get_field(
        field_id=field_id,
        token=token,
        user_id=user_id,
    )

    # --------------------------------------------------------
    # 2. Define NASA Data Date Range
    # --------------------------------------------------------

    # NASA POWER data may have publication latency.
    # Use a 7-day delay to avoid requesting incomplete
    # recent observations.

    end = date.today() - timedelta(days=7)

    start = end - timedelta(
        days=config.SEASON_DAYS - 1
    )

    # --------------------------------------------------------
    # 3. Create Personal Cache Identifier
    # --------------------------------------------------------

    # Prevent personal field cache keys from overlapping
    # with demo field cache keys.

    cache_field_id = (
        f"personal_{user_id}_{field.id}"
    )

    # --------------------------------------------------------
    # 4. Fetch NASA Environmental Data
    # --------------------------------------------------------

    series, source, sources = registry.fetch_with_fallback(
        field_id=cache_field_id,
        lat=field.centroid_lat,
        lon=field.centroid_lon,
        start=start,
        end=end,
        refresh=refresh,
    )

    # --------------------------------------------------------
    # 5. Clean NASA Data
    # --------------------------------------------------------

    cleaned, coverage = cleaning.clean_series(
        series
    )

    # --------------------------------------------------------
    # TEMPORARY NDVI DEBUGGING
    # --------------------------------------------------------

    # Count valid NDVI values before cleaning.

    ndvi_before = sum(
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and -1 <= value <= 1
        for value in series.get("ndvi", [])
    )

    # Count valid NDVI values after cleaning.

    ndvi_after = sum(
        value is not None
        for value in cleaned.get("ndvi", [])
    )

    # Identify the latest available NDVI observation.

    ndvi_dates = cleaned.get("dates", [])
    ndvi_values = cleaned.get("ndvi", [])

    valid_ndvi = [
        (day, value)
        for day, value in zip(ndvi_dates, ndvi_values)
        if value is not None
    ]

    latest_ndvi = (
        valid_ndvi[-1]
        if valid_ndvi
        else None
    )

    print("\n========== FUTUREFIELD NDVI DEBUG ==========")
    print("Field ID:", field.id)
    print("Latitude:", field.centroid_lat)
    print("Longitude:", field.centroid_lon)
    print("Refresh requested:", refresh)
    print("Date range:", start, "to", end)
    print("Environmental source:", source)
    print("NASA sources:", sources)
    print("NDVI before cleaning:", ndvi_before)
    print("NDVI after cleaning:", ndvi_after)
    print("Latest valid NDVI:", latest_ndvi)
    print("============================================\n")

    # --------------------------------------------------------
    # 6. Calculate Environmental Indicators
    # --------------------------------------------------------

    computed = indicators.compute_indicators(
        cleaned
    )

    # --------------------------------------------------------
    # 7. Normalize Indicators
    # --------------------------------------------------------

    normalized = normalization.normalize_indicators(
        computed
    )

    # --------------------------------------------------------
    # 8. Calculate Data Quality Score
    # --------------------------------------------------------

    quality = cleaning.data_quality_score(
        coverage,
        source,
    )

    # --------------------------------------------------------
    # 9. Return Environmental Data
    # --------------------------------------------------------

    return EnvironmentalData(
        field_id=field.id,

        dataset=(
            "nasa_power"
            if source in ("real", "partial")
            else "mock"
        ),

        start=start.isoformat(),

        end=end.isoformat(),

        indicators=computed,

        normalized=normalized,

        monthly=aggregation.monthly_summary(
            cleaned
        ),

        daily={
            key: cleaned[key]
            for key in cleaned
        },

        quality_score=quality,

        source=source,

        sources=sources or [source],

        fetched_at=datetime.now(timezone.utc),
    )