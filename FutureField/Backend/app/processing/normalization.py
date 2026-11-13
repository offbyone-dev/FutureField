"""Step 4: indicators -> 0..1 scale (min-max with clipping over reference ranges)."""

# (min, max) reference ranges for Bangladesh tropical context.
# Sources: FAO crop water requirements, regional climate norms, BARC data.
REFERENCE_RANGES: dict[str, tuple[float, float]] = {
    "rain_total_mm":     (0.0,    3000.0),   # seasonal rainfall (mm)
    "dry_spell_max_days":(0.0,    30.0),      # longest dry run (days)
    "gdd":               (0.0,    3500.0),    # growing degree-days (°C·day, base 10)
    "heat_stress_days":  (0.0,    30.0),      # days Tmax > 35°C
    "mean_temp_c":       (5.0,    40.0),      # seasonal mean temperature (°C)
    "ndvi_trend":        (-0.005, 0.005),     # NDVI linear slope
    "season_days":       (0.0,    200.0),     # window length (days)
    "rain_std_monthly":  (0.0,    500.0),     # monthly rain std dev (mm)
    "et_mm_per_day":     (0.0,    10.0),      # daily reference ET (mm/day)
    "soil_moisture_pct": (0.0,    60.0),      # volumetric soil moisture %
}


def normalize_value(x: float, lo: float, hi: float) -> float:
    return max(0.0, min(1.0, (x - lo) / (hi - lo)))


def normalize_indicators(indicators: dict[str, float]) -> dict[str, float]:
    return {
        k: round(normalize_value(v, *REFERENCE_RANGES[k]), 4)
        for k, v in indicators.items()
        if k in REFERENCE_RANGES
    }
