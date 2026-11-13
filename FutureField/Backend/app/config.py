"""Central settings and feature flags. Change behaviour with env vars, not code."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"

_env_file = BASE_DIR / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _key, _val = _line.split("=", 1)
        os.environ.setdefault(_key.strip(), _val.strip())

DATA_DIR = Path(os.getenv("FUTUREFIELD_DATA_DIR", BASE_DIR / "data"))

# True  -> never call NASA, always use mock_provider (safe for demos/tests)
# False -> try real NASA clients first, fall back to mock on failure
USE_MOCK_NASA = os.getenv("USE_MOCK_NASA", "false").lower() == "true"

SEASON_DAYS = int(os.getenv("SEASON_DAYS", "180"))  # analysis window (days)
NASA_TIMEOUT_S = float(os.getenv("NASA_TIMEOUT_S", "45"))
FARM_NAME = os.getenv("FARM_NAME", "FutureField Farm")

# NASA Earthdata Login credentials (for GPM IMERG and optional SMAP access)
# Set via .env or environment variables — never hardcode passwords in source.
EARTHDATA_USER = os.getenv("EARTHDATA_USER", "")
EARTHDATA_PASS = os.getenv("EARTHDATA_PASS", "")
EARTHDATA_TOKEN = os.getenv("EARTHDATA_TOKEN", "")

# Feature flags for optional high-resolution NASA sources
# True  → attempt GPM IMERG for precipitation (requires Earthdata credentials)
# False → use NASA POWER PRECTOTCORR (always available, no auth needed)
USE_IMERG = os.getenv("USE_IMERG", "true").lower() == "true"

# Default origins cover the Figma-Make dev server (8443) and the standard Vite
# dev server (5173). Add more with a comma-separated FRONTEND_ORIGINS env var.
_default_origins = "http://localhost:5173,http://localhost:8443,http://127.0.0.1:5173,http://127.0.0.1:8443"
FRONTEND_ORIGINS = [
    o.strip()
    for o in os.getenv("FRONTEND_ORIGINS", _default_origins).split(",")
    if o.strip()
]
# ─── Supabase Configuration ────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")

SUPABASE_PUBLISHABLE_KEY = os.getenv(
    "SUPABASE_PUBLISHABLE_KEY", ""
)