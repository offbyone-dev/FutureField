"""Field CRUD + boundary validation."""
import uuid
from datetime import datetime, timezone

from app.data_sources import cache
from app.errors import NotFoundError
from app.knowledge.loader import load_regions
from app.schemas.field import FieldCreate, FieldOut
from app.storage import json_store
from app.utils import geo


def _build_field(payload: FieldCreate, field_id: str, created_at) -> FieldOut:
    geo.validate_polygon(payload.boundary, load_regions()["supported_bbox"])
    lat, lon = geo.centroid(payload.boundary)
    return FieldOut(
        **payload.model_dump(), id=field_id,
        centroid_lat=lat, centroid_lon=lon,
        area_ha=round(geo.area_ha(payload.boundary), 3), created_at=created_at,
    )


def _invalidate_environment(field_id: str) -> None:
    json_store.delete("environment", field_id)
    cache.cache_delete(field_id, "series")


def create_field(payload: FieldCreate, field_id: str | None = None) -> FieldOut:
    field = _build_field(payload, field_id or uuid.uuid4().hex[:8], datetime.now(timezone.utc))
    json_store.save("fields", field.id, field.model_dump(mode="json"))
    return field


def get_field(field_id: str) -> FieldOut:
    raw = json_store.load("fields", field_id)
    if raw is None:
        raise NotFoundError(f"Field '{field_id}' not found")
    return FieldOut(**raw)


def list_fields() -> list[FieldOut]:
    return [FieldOut(**r) for r in json_store.list_all("fields")]


def update_field(field_id: str, payload: FieldCreate) -> FieldOut:
    """Keeps id + created_at. If the boundary moved, drop cached NASA/mock series
    so the next environment fetch uses the new centroid."""
    old = get_field(field_id)
    field = _build_field(payload, old.id, old.created_at)
    json_store.save("fields", field.id, field.model_dump(mode="json"))
    if old.boundary != payload.boundary:
        _invalidate_environment(field.id)
    return field


def delete_field(field_id: str) -> None:
    """Remove a field and its associated cached data."""
    get_field(field_id)  # raises NotFoundError if missing
    _invalidate_environment(field_id)
    json_store.delete("fields", field_id)
