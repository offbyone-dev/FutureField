"""Compute agronomic indicators from observed daily values; retain coverage flags."""
import math
from collections import defaultdict
from app.data_sources.base import DailySeries

def _valid(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

def _slope_observed(values: list, dates: list[str]) -> float:
    points = [(i, float(v)) for i, v in enumerate(values) if _valid(v)]
    if len(points) < 2:
        return 0.0
    xm = sum(x for x, _ in points) / len(points)
    ym = sum(y for _, y in points) / len(points)
    den = sum((x - xm) ** 2 for x, _ in points)
    return sum((x - xm) * (y - ym) for x, y in points) / den if den else 0.0

def _monthly_rain_std(rain: list, dates: list[str]) -> float:
    totals = defaultdict(float)
    counts = defaultdict(int)
    days = defaultdict(int)
    for d, v in zip(dates, rain):
        month = d[:7]
        days[month] += 1
        if _valid(v):
            totals[month] += v
            counts[month] += 1
    # Compare only months with complete coverage; partial months bias variability.
    vals = [totals[m] for m in days if counts[m] == days[m]]
    if len(vals) < 2:
        return 0.0
    avg = sum(vals) / len(vals)
    return round(math.sqrt(sum((v - avg) ** 2 for v in vals) / len(vals)), 1)

def _hargreaves_et(pairs: list[tuple[float, float]]) -> float:
    """Approximate ETo using fixed Ra=12 MJ/m²/day (not NASA-measured ET)."""
    if not pairs:
        return 0.0
    ra = 12.0
    values = [0.0023 * ((hi + lo) / 2 + 17.8) * math.sqrt(max(0.0, hi - lo)) * ra for hi, lo in pairs]
    return round(sum(values) / len(values), 3)

def compute_indicators(series: DailySeries, t_base: float = 10.0,
                       heat_threshold: float = 35.0, dry_day_mm: float = 1.0) -> dict[str, float]:
    dates = series.get("dates", [])
    n = len(dates)
    tmax = series.get("tmax", [None] * n)
    tmin = series.get("tmin", [None] * n)
    rain = series.get("rain", [None] * n)
    paired = [(float(a), float(b)) for a, b in zip(tmax, tmin) if _valid(a) and _valid(b)]
    observed_rain = [float(v) for v in rain if _valid(v)]
    tmean = [(a + b) / 2 for a, b in paired]
    longest = current = 0
    for value in rain:
        if not _valid(value):
            current = 0  # unknown day breaks a *confirmed* dry spell
        elif value < dry_day_mm:
            current += 1
        else:
            current = 0
        longest = max(longest, current)
    out: dict[str, float] = {
        "rain_total_mm": round(sum(observed_rain), 1),
        "dry_spell_max_days": float(longest),
        "gdd": round(sum(max(0.0, t - t_base) for t in tmean), 1),
        "heat_stress_days": float(sum(v > heat_threshold for v in tmax if _valid(v))),
        "mean_temp_c": round(sum(tmean) / len(tmean), 2) if tmean else 0.0,
        "ndvi_trend": round(_slope_observed(series.get("ndvi", []), dates), 6),
        "season_days": float(n),
        "rain_std_monthly": _monthly_rain_std(rain, dates),
        "et_mm_per_day": _hargreaves_et(paired),
        "rain_coverage_pct": round(100 * len(observed_rain) / n, 1) if n else 0.0,
        "temperature_coverage_pct": round(100 * len(paired) / n, 1) if n else 0.0,
        "rain_total_incomplete": float(len(observed_rain) != n),
        "gdd_incomplete": float(len(paired) != n),
        "dry_spell_incomplete": float(len(observed_rain) != n),
        "et_estimated": 1.0,
    }
    if "ndvi" in series:
        vals = [float(v) for v in series["ndvi"] if _valid(v) and v >= 0]
        out["ndvi_coverage_pct"] = round(100 * len(vals) / n, 1) if n else 0.0
        if vals:
            out["ndvi_mean"] = round(sum(vals) / len(vals), 3)
            out["ndvi_latest"] = round(vals[-1], 3)
    if "soil_moisture" in series:
        vals = [float(v) for v in series["soil_moisture"] if _valid(v) and 0 <= v <= 1]
        out["soil_moisture_coverage_pct"] = round(100 * len(vals) / n, 1) if n else 0.0
        if vals:
            # GWETROOT is relative wetness, not measured volumetric water content.
            out["soil_moisture_pct"] = round(sum(vals) / len(vals) * 100, 1)
            out["soil_moisture_latest_pct"] = round(vals[-1] * 100, 1)
    return out
