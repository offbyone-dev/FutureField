"""NASA Soil Moisture client — NASA POWER MERRA-2 multi-layer soil wetness.

Primary source: NASA POWER AG Community API (public, no auth required)
Variables fetched:
  - GWETROOT  Root-zone soil wetness          (0–1 fraction, ~0–100 cm)
  - GWETTOP   Top soil layer wetness          (0–1 fraction, ~0–10 cm)
  - GWETPROF  Soil profile wetness            (0–1 fraction, full column)

These are MERRA-2 land-surface model outputs that assimilate SMAP Level-2
retrievals (since 2015-04-01) as part of the Modern-Era Retrospective
analysis. They are therefore a real, validated NASA soil moisture product.

Why not raw SMAP HDF5?
  - SPL3SMP / SPL4SMGP files are 300–700 MB per day.
  - Parsing requires netCDF4/h5py not in the requirements set.
  - POWER GWETROOT correlates at r > 0.85 with SMAP L3 in peer-reviewed
    literature (Reichle et al., 2017, JGR Biogeosciences).
  - POWER has no data gaps, covers 1981–present.

Integration:
  The returned 'soil_moisture' key (GWETROOT, 0–1) is read by
  processing/indicators.py which converts it to soil_moisture_pct (× 100).
  That value feeds field_intelligence.py's soil_score bonus.

References:
  NASA POWER: https://power.larc.nasa.gov/
  Reichle et al. (2017): doi:10.1002/2016JD025635
"""

import logging
from datetime import date, timedelta

import httpx

from app import config
from app.data_sources.base import FILL_VALUE, DailySeries, DataSource

log = logging.getLogger(__name__)

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
_SM_PARAMS = "GWETROOT,GWETTOP,GWETPROF"


def _clean(v: object) -> float:
    """Return float or FILL_VALUE for NASA POWER sentinel values."""
    if v is None:
        return FILL_VALUE
    fv = float(v)
    return FILL_VALUE if fv < -90 else fv


class NasaSoilMoistureClient(DataSource):
    """NASA MERRA-2 soil wetness via NASA POWER (real NASA data, no auth)."""

    name = "nasa_power_soil"

    def get_series(self, lat: float, lon: float, start: date, end: date) -> DailySeries:
        """Fetch multi-layer soil wetness from NASA POWER for the given point and period.

        Returns
        -------
        DailySeries with keys:
          'dates'          – ISO date strings
          'soil_moisture'  – GWETROOT (0–1), root-zone wetness used by indicators
          'soil_top'       – GWETTOP (0–1), surface layer (0–10 cm)
          'soil_profile'   – GWETPROF (0–1), full column wetness

        Raises
        ------
        ValueError / httpx.HTTPStatusError if the API is unreachable or returns
        no valid data. The registry will then fall back to the mock provider.
        """
        query = {
            "parameters": _SM_PARAMS,
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
            raise ValueError(f"Unexpected POWER soil response: {exc}") from exc

        n = (end - start).days + 1
        days = [start + timedelta(days=i) for i in range(n)]
        dates = [d.isoformat() for d in days]

        gwetroot = raw.get("GWETROOT", {})
        gwettop  = raw.get("GWETTOP",  {})
        gwetprof = raw.get("GWETPROF", {})

        sm_root    = [_clean(gwetroot.get(d.strftime("%Y%m%d"))) for d in days]
        sm_top     = [_clean(gwettop.get(d.strftime("%Y%m%d")))  for d in days]
        sm_profile = [_clean(gwetprof.get(d.strftime("%Y%m%d"))) for d in days]

        valid = sum(1 for v in sm_root if v != FILL_VALUE)
        if valid == 0:
            raise ValueError("NASA POWER GWETROOT returned all fill values for this location/period")

        log.info("NASA POWER soil moisture: %d/%d valid days for (%.3f, %.3f)", valid, n, lat, lon)

        return {
            "dates":        dates,
            "soil_moisture": sm_root,    # primary – used by indicators.py
            "soil_top":     sm_top,      # surface layer (informational)
            "soil_profile": sm_profile,  # full column (informational)
        }
