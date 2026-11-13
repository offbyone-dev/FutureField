"""Geometry helpers for GeoJSON Polygon boundaries ([lon, lat] order)."""
import math

from app.errors import InvalidInputError


def _ring(geojson: dict) -> list[list[float]]:
    if geojson.get("type") != "Polygon":
        raise InvalidInputError("Boundary must be a GeoJSON Polygon")
    try:
        ring = geojson["coordinates"][0]
    except (KeyError, IndexError, TypeError):
        raise InvalidInputError("Polygon has no coordinates")
    if len(ring) < 4:
        raise InvalidInputError("Polygon needs at least 3 distinct points")
    return ring


def validate_polygon(geojson: dict, bbox: list[float]) -> None:
    """Raise InvalidInputError if boundary is unusable.

    TODO(inside): add shapely: Polygon(ring).is_valid (self-intersection check),
    reject area > MAX_AREA_HA and area < MIN_AREA_HA.
    """
    ring = _ring(geojson)
    min_lon, min_lat, max_lon, max_lat = bbox
    for lon, lat in ring:
        if not (min_lon <= lon <= max_lon and min_lat <= lat <= max_lat):
            raise InvalidInputError("Boundary is outside the supported area")
    if area_ha(geojson) <= 0:
        raise InvalidInputError("Boundary has zero area")


def centroid(geojson: dict) -> tuple[float, float]:
    """Return (lat, lon). TODO(inside): use shapely centroid for concave polygons."""
    ring = _ring(geojson)[:-1]
    lon = sum(p[0] for p in ring) / len(ring)
    lat = sum(p[1] for p in ring) / len(ring)
    return lat, lon


def area_ha(geojson: dict) -> float:
    """Approximate area in hectares via local equirectangular projection + shoelace."""
    ring = _ring(geojson)
    lat0 = sum(p[1] for p in ring) / len(ring)
    kx = 111_320 * math.cos(math.radians(lat0))
    ky = 110_540
    pts = [(p[0] * kx, p[1] * ky) for p in ring]
    s = sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(len(pts) - 1))
    return abs(s) / 2 / 10_000
