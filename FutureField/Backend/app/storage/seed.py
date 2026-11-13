"""Demo fields so the app always has a farm to explore."""
from app.schemas.field import FieldCreate, SoilInfo
from app.services import field_service
from app.storage import json_store


def _square(lat: float, lon: float, d: float = 0.003) -> dict:
    ring = [[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]
    return {"type": "Polygon", "coordinates": [ring]}


DEMO_FIELDS = {
    "demo-1": FieldCreate(
        name="North Rice Field",
        boundary=_square(23.80, 90.40),
        irrigation_type="rainfed",
        water_source="rain",
        soil=SoilInfo(texture="loam", ph=6.6, organic_matter=2.5, drainage="moderate"),
        division="Dhaka",
        district="Gazipur",
        current_crop="Rice",
        previous_crops=["Mustard", "Wheat"],
    ),
    "demo-2": FieldCreate(
        name="East Clay Field",
        boundary=_square(24.90, 91.87),
        irrigation_type="irrigated",
        water_source="canal",
        soil=SoilInfo(texture="clay_loam", ph=6.0, organic_matter=1.8, drainage="moderate"),
        division="Sylhet",
        district="Sylhet",
        current_crop="Maize",
        previous_crops=["Rice"],
    ),
}


def seed_demo_fields() -> None:
    for fid, payload in DEMO_FIELDS.items():
        stored = json_store.load("fields", fid)
        stored_ph = stored.get("soil", {}).get("ph") if stored else None
        field_service.create_field(payload, field_id=fid)
        if stored_ph is not None and stored_ph != payload.soil.ph:
            json_store.delete("environment", fid)
            from app.data_sources import cache
            cache.cache_delete(fid, "series")
