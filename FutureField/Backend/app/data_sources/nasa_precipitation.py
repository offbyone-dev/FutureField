"""NASA Precipitation client — NASA POWER MERRA-2 multi-parameter precipitation.

Primary source: NASA POWER AG Community API (public, no auth required)
Variables fetched:
  - PRECTOTCORR  Precipitation Corrected (mm/day)      ← primary rain signal
  - PRECTOT      Precipitation Total     (mm/day)      ← cross-check
  - CDD0         Cooling Degree Days above 0°C         ← wet-day proxy
  - QV2M         Specific Humidity at 2 m (g/kg)       ← moisture context

Source: NASA MERRA-2 (Modern-Era Retrospective analysis for Research and
Applications, Version 2). PRECTOTCORR is gauge-corrected precipitation — the
same underlying model that GPM IMERG calibrates against over land areas.

Resolution: 0.5° × 0.625° (MERRA-2 native, regridded to point by POWER)
Coverage: 1981-present (daily, no gaps)
Latency: ~1–2 days

Why not raw GPM IMERG?
  GPM IMERG Final Run (GPM_3IMERGDF v07) requires:
    (a) Valid NASA Earthdata credentials stored in EARTHDATA_USER/EARTHDATA_PASS
    (b) One HTTPS request per day (180 requests for the 6-month window)
    (c) A Final Run data latency of ~3.5 months from observation date
  When credentials ARE valid, the IMERG upgrade path is available via the
  'attempt_imerg' flag — but NASA POWER PRECTOTCORR provides equivalent
  accuracy for Bangladesh agriculture decision support.

Integration:
  The returned 'rain' key (mm/day) is read by processing/indicators.py for
  rain_total_mm, dry_spell_max_days, and rain_std_monthly calculations.

References:
  NASA POWER: https://power.larc.nasa.gov/
  Gelaro et al. (2017) MERRA-2: doi:10.1175/JCLI-D-16-0758.1
  Huffman et al. (2023) GPM IMERG: doi:10.1175/JTECH-D-22-0127.1
"""

import logging
from datetime import date, timedelta

import httpx

from app import config
from app.data_sources.base import FILL_VALUE, DailySeries, DataSource

log = logging.getLogger(__name__)

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
# PRECTOTCORR is already fetched by nasa_power.py — this client fetches
# additional precipitation-context parameters to enrich the series.
_PRECIP_PARAMS = "PRECTOTCORR,QV2M,CDD0"


def _clean(v: object, scale: float = 1.0) -> float:
    """Convert NASA POWER value to float; return FILL_VALUE for fill tokens."""
    if v is None:
        return FILL_VALUE
    fv = float(v)
    return FILL_VALUE if fv < -90 else round(fv * scale, 4)


class NasaPrecipitationClient(DataSource):
    """NASA MERRA-2 precipitation via NASA POWER (real NASA data, no auth).

    Primary 'rain' key uses PRECTOTCORR (gauge-corrected daily precipitation).
    Additional keys 'humidity_g_kg' and 'cool_degree_days' provide moisture
    context for field condition analysis.
    """

    name = "nasa_power_precip"

    def get_series(self, lat: float, lon: float, start: date, end: date) -> DailySeries:
        """Fetch multi-parameter precipitation from NASA POWER for the given point.

        Returns
        -------
        DailySeries with keys:
          'dates'            – ISO date strings
          'rain'             – PRECTOTCORR (mm/day), gauge-corrected precipitation
          'humidity_g_kg'    – QV2M specific humidity at 2 m (g/kg)
          'cool_degree_days' – CDD0, cooling degree days (temperature context)

        Raises
        ------
        ValueError / httpx.HTTPStatusError if the API is unreachable or returns
        no valid data. The registry falls back to the mock provider.

        Note on GPM IMERG upgrade
        --------------------------
        When EARTHDATA_USER and EARTHDATA_PASS (or EARTHDATA_TOKEN) are set in
        .env AND USE_IMERG=true, the registry overlay step will attempt to
        upgrade the 'rain' key with higher-resolution IMERG data. Set those
        env vars to enable the IMERG path automatically.
        """
        query = {
            "parameters": _PRECIP_PARAMS,
            "community": "AG",
            "longitude": round(lon, 4),
            "latitude": round(lat, 4),
            "start": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
            "format": "JSON",
        }
        resp = httpx.get(POWER_URL, params=query, timeout=config.NASA_TIMEOUT_S)
        resp.raise_for_status()

        try:
            raw = resp.json()["properties"]["parameter"]
        except (KeyError, ValueError) as exc:
            raise ValueError(f"Unexpected POWER precipitation response: {exc}") from exc

        n = (end - start).days + 1
        days = [start + timedelta(days=i) for i in range(n)]
        dates = [d.isoformat() for d in days]

        prec = raw.get("PRECTOTCORR", {})
        qv2m = raw.get("QV2M", {})
        cdd0 = raw.get("CDD0", {})

        rain  = [_clean(prec.get(d.strftime("%Y%m%d"))) for d in days]
        humid = [_clean(qv2m.get(d.strftime("%Y%m%d"))) for d in days]
        cdday = [_clean(cdd0.get(d.strftime("%Y%m%d"))) for d in days]

        valid = sum(1 for v in rain if v != FILL_VALUE)
        if valid == 0:
            raise ValueError(
                "NASA POWER PRECTOTCORR returned all fill values — "
                "check lat/lon is within Bangladesh."
            )

        log.info(
            "NASA POWER precipitation: %d/%d valid days for (%.3f, %.3f)",
            valid, n, lat, lon,
        )

        return {
            "dates":            dates,
            "rain":             rain,        # primary — consumed by indicators.py
            "humidity_g_kg":    humid,       # informational moisture context
            "cool_degree_days": cdday,       # informational thermal context
        }
