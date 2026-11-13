"""Deterministic synthetic data in the same shape as real providers.

Same lat/lon -> same series, so tests and demos are reproducible.
The mock data simulates a tropical Bangladesh-like climate:
- Warm year-round (28-34°C), seasonal temperature swing.
- Monsoon-weighted rainfall (heaviest June-September).
- NDVI follows a bell curve peaking mid-season.
- Synthetic soil-moisture proxy included.
"""
import math
import random
from datetime import date, timedelta

from app.data_sources.base import DailySeries, DataSource


class MockProvider(DataSource):
    name = "mock"

    def get_series(self, lat: float, lon: float, start: date, end: date) -> DailySeries:
        # Deterministic seed: same field location -> same synthetic series.
        rng = random.Random(int(abs(lat) * 1000) * 7919 + int(abs(lon) * 1000))
        n = (end - start).days + 1

        s: DailySeries = {
            "dates": [],
            "tmax": [],
            "tmin": [],
            "rain": [],
            "ndvi": [],
            "soil_moisture": [],
        }

        # Track a simple soil-moisture proxy (0..1) using a "bucket" model.
        soil_moisture = 0.35  # starting volumetric fraction

        for i in range(n):
            d = start + timedelta(days=i)
            doy = d.timetuple().tm_yday

            # Seasonal temperature: peaks around late April/May (DOY ~120), cooler in winter
            temp_seasonal = math.sin(2 * math.pi * (doy - 80) / 365)
            # Monsoon rainfall: peaks DOY 160-270 (June-September)
            monsoon_phase = math.sin(max(0.0, math.pi * (doy - 150) / 120)) if 150 <= doy <= 270 else 0.0

            tmax = 31.0 + 3.5 * temp_seasonal + rng.gauss(0, 1.2)
            tmin = tmax - 9.0 + rng.gauss(0, 0.8)

            # Rain: monsoon-weighted probability with exponential magnitude
            rain_prob = 0.20 + 0.45 * monsoon_phase
            rain = rng.expovariate(1 / 14) if rng.random() < rain_prob else 0.0

            # NDVI: bell curve, modulated by monsoon (greener during wet season)
            ndvi = (
                0.42
                + 0.25 * math.sin(i / max(n, 1) * math.pi)
                + 0.08 * monsoon_phase
                + rng.gauss(0, 0.015)
            )
            ndvi = max(0.05, min(0.95, ndvi))

            soil_moisture = min(0.55, max(0.08, soil_moisture + rain * 0.012 - 0.006))
            s["dates"].append(d.isoformat())
            s["tmax"].append(round(tmax, 2))
            s["tmin"].append(round(tmin, 2))
            s["rain"].append(round(rain, 2))
            s["ndvi"].append(round(ndvi, 3))
            s["soil_moisture"].append(round(soil_moisture, 3))

        return s
