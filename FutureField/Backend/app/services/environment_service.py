"""Orchestrates: raw fetch (cache/real/mock) -> clean -> aggregate -> indicators -> normalize -> store."""
from datetime import date, datetime, timedelta, timezone

from app import config
from app.data_sources import registry
from app.processing import aggregation, cleaning, indicators, normalization
from app.schemas.environment import EnvironmentalData
from app.services import field_service
from app.storage import json_store


def get_environment(field_id: str, refresh: bool = False) -> EnvironmentalData:
    if not refresh:
        cached = json_store.load("environment", field_id)
        if cached:
            return EnvironmentalData(**cached)
    field = field_service.get_field(field_id)
    end = date.today()
    start = end - timedelta(days=config.SEASON_DAYS - 1)
    series, source, sources = registry.fetch_with_fallback(
        field.id, field.centroid_lat, field.centroid_lon, start, end)
    cleaned, coverage = cleaning.clean_series(series)
    quality = cleaning.data_quality_score(coverage, source)
    ind = indicators.compute_indicators(cleaned)
    env = EnvironmentalData(
        field_id=field.id,
        dataset="nasa_power" if source in ("real", "partial") else "mock",
        start=start.isoformat(), end=end.isoformat(), indicators=ind,
        normalized=normalization.normalize_indicators(ind),
        monthly=aggregation.monthly_summary(cleaned),
        daily={k: cleaned[k] for k in cleaned},
        quality_score=quality, source=source, sources=sources or [source],
        fetched_at=datetime.now(timezone.utc))
    json_store.save("environment", field.id, env.model_dump(mode="json"))
    return env
