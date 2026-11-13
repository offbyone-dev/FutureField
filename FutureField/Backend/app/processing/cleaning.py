"""Validate daily NASA observations without inventing missing measurements."""
import math
from app.data_sources.base import FILL_VALUE, DailySeries

NUMERIC_KEYS = ("tmax", "tmin", "rain", "ndvi", "soil_moisture", "rh", "soil_top", "soil_profile", "humidity_g_kg", "cool_degree_days")
RANGES = {
    "tmax": (-60.0, 65.0), "tmin": (-80.0, 55.0),
    "rain": (0.0, 500.0), "ndvi": (-1.0, 1.0),
    "soil_moisture": (0.0, 1.0), "soil_top": (0.0, 1.0),
    "soil_profile": (0.0, 1.0), "rh": (0.0, 100.0),
    "humidity_g_kg": (0.0, 50.0), "cool_degree_days": (0.0, 100.0),
}

def _valid(value, key: str):
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(number) or number == FILL_VALUE or number <= -900:
        return None
    lo, hi = RANGES.get(key, (-math.inf, math.inf))
    return number if lo <= number <= hi else None

def clean_series(series: DailySeries) -> tuple[DailySeries, float]:
    """Keep gaps as None; coverage is fraction of valid supplied observations."""
    dates = list(series.get("dates", []))
    cleaned: DailySeries = {"dates": dates}
    total = good = 0
    for key in NUMERIC_KEYS:
        if key not in series:
            continue
        values = series[key]
        if len(values) != len(dates):
            raise ValueError(f"{key}: {len(values)} values for {len(dates)} dates")
        cleaned_values = [_valid(v, key) for v in values]
        cleaned[key] = cleaned_values
        total += len(cleaned_values)
        good += sum(v is not None for v in cleaned_values)
    return cleaned, round(good / total, 4) if total else 0.0

def data_quality_score(coverage: float, source: str) -> float:
    """Heuristic coverage score; NOT a guarantee of scientific accuracy."""
    multiplier = {"real": 1.0, "partial": 0.75, "mock": 0.0}.get(source, 0.0)
    return round(max(0.0, min(1.0, coverage)) * multiplier, 3)
