"""NASA raw-data cache with location and date-range awareness."""

import hashlib
import json
from datetime import date

from app.storage import json_store


def _cache_key(
    field_id: str,
    dataset: str,
    lat: float,
    lon: float,
    start: date,
    end: date,
) -> str:
    payload = {
        "field_id": field_id,
        "dataset": dataset,
        "latitude": round(lat, 5),
        "longitude": round(lon, 5),
        "start": start.isoformat(),
        "end": end.isoformat(),
    }

    encoded = json.dumps(
        payload,
        sort_keys=True,
    ).encode("utf-8")

    return hashlib.sha256(encoded).hexdigest()


def cache_get(
    field_id: str,
    dataset: str,
    lat: float,
    lon: float,
    start: date,
    end: date,
) -> dict | None:

    key = _cache_key(
        field_id, dataset, lat, lon, start, end
    )

    return json_store.load("cache", key)


def cache_put(
    field_id: str,
    dataset: str,
    lat: float,
    lon: float,
    start: date,
    end: date,
    series: dict,
    source: str,
    sources: list[str] | None = None,
) -> None:

    key = _cache_key(
        field_id, dataset, lat, lon, start, end
    )

    json_store.save(
        "cache",
        key,
        {
            "series": series,
            "source": source,
            "sources": sources or [source],
        },
    )


def cache_delete(
    field_id: str,
    dataset: str,
    lat: float,
    lon: float,
    start: date,
    end: date,
) -> None:

    key = _cache_key(
        field_id, dataset, lat, lon, start, end
    )

    json_store.delete("cache", key)