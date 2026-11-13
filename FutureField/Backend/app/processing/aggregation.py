"""Monthly observed summaries; missing values do not count as zero."""
import math
from collections import defaultdict
from app.data_sources.base import DailySeries

def _valid(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)

def monthly_summary(series: DailySeries) -> dict[str, dict[str, float]]:
    dates = series.get("dates", [])
    groups: dict[str, list[int]] = defaultdict(list)
    for i, day in enumerate(dates):
        groups[day[:7]].append(i)
    result = {}
    for month, indices in sorted(groups.items()):
        row: dict[str, float] = {}
        def observed(key):
            values = series.get(key, [])
            return [float(values[i]) for i in indices if i < len(values) and _valid(values[i])]
        rain = observed("rain")
        row["rain_mm"] = round(sum(rain), 1)
        row["rain_coverage_pct"] = round(100 * len(rain) / len(indices), 1)
        row["rain_incomplete"] = float(len(rain) != len(indices))
        tmax, tmin = series.get("tmax", []), series.get("tmin", [])
        temps = [(float(tmax[i]) + float(tmin[i])) / 2 for i in indices
                 if i < len(tmax) and i < len(tmin) and _valid(tmax[i]) and _valid(tmin[i])]
        # Omit mean if no temperature observations rather than fabricating zero.
        if temps:
            row["tmean_c"] = round(sum(temps) / len(temps), 2)
        row["temperature_coverage_pct"] = round(100 * len(temps) / len(indices), 1)
        for key, output, scale, digits in (("ndvi", "ndvi", 1, 3),
                                           ("soil_moisture", "soil_moisture_pct", 100, 1)):
            if key in series:
                values = observed(key)
                if values:
                    row[output] = round(sum(values) / len(values) * scale, digits)
                row[f"{key}_coverage_pct"] = round(100 * len(values) / len(indices), 1)
        result[month] = row
    return result

def baseline_vs_recent(recent: DailySeries, baseline: DailySeries | None) -> dict[str, float]:
    """No climatological anomaly until a validated long-term baseline is available."""
    return {}
