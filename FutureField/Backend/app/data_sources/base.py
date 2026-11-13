"""Common interface for every data source (mock and real NASA clients).

A "daily series" is a plain dict of equal-length lists:
    {"dates": ["2026-06-01", ...], "tmax": [...], "tmin": [...], "rain": [...], "ndvi": [...]}
Units: degC, mm/day, NDVI 0..1. Missing values use FILL_VALUE (-999.0).
"""
from abc import ABC, abstractmethod
from datetime import date

FILL_VALUE = -999.0
DailySeries = dict[str, list]

class DataSource(ABC):
    name: str = "base"

    @abstractmethod
    def get_series(self, lat: float, lon: float, start: date, end: date) -> DailySeries:
        """Return a daily series for the point. Raise on failure (registry handles fallback)."""

