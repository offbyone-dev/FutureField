"""NASA POWER daily meteorology (AG community, single point). Public API, no token."""
from datetime import date, timedelta

import httpx

from app import config
from app.data_sources.base import FILL_VALUE, DailySeries, DataSource

BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = {
    "tmax": "T2M_MAX",
    "tmin": "T2M_MIN",
    "rain": "PRECTOTCORR",
    "soil_moisture": "GWETROOT",
    "rh": "RH2M",
}


class NasaPowerClient(DataSource):
    name = "nasa_power"

    def get_series(self, lat: float, lon: float, start: date, end: date) -> DailySeries:
        query = {
            "parameters": ",".join(PARAMS.values()),
            "community": "AG",
            "longitude": lon,
            "latitude": lat,
            "start": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
            "format": "JSON",
        }
        resp = httpx.get(BASE_URL, params=query, timeout=config.NASA_TIMEOUT_S)
        resp.raise_for_status()
        try:
            data = resp.json()["properties"]["parameter"]
        except (KeyError, ValueError) as exc:
            raise ValueError(f"Unexpected NASA POWER response shape: {exc}") from exc

        n = (end - start).days + 1
        days = [start + timedelta(days=i) for i in range(n)]
        series: DailySeries = {"dates": [d.isoformat() for d in days]}
        for key, nasa_name in PARAMS.items():
            if nasa_name not in data:
                continue
            by_day = data[nasa_name]
            vals = [by_day.get(d.strftime("%Y%m%d"), FILL_VALUE) for d in days]
            cleaned = []
            for v in vals:
                if v is None:
                    cleaned.append(FILL_VALUE)
                    continue
                num = float(v)
                cleaned.append(FILL_VALUE if num < -90 else num)
            series[key] = cleaned
        for required in ("tmax", "tmin", "rain"):
            if required not in series:
                raise ValueError(f"NASA POWER response is missing '{required}'")
        return series
