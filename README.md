# FutureField

**Better Farm Decisions — Powered by Earth Observation**

FutureField is a web-based agricultural decision-support platform that combines NASA Earth observation data with farmer-provided field information. It helps users understand environmental conditions, evaluate crop suitability, explore crop rotations and compare climate scenarios before making seasonal farming decisions.

**Live application:** https://future-field.vercel.app/

> FutureField provides decision support, not a guarantee of yield or a replacement for local agronomic advice. Observed environmental indicators, calculated scores and hypothetical scenarios serve different purposes and should be interpreted accordingly.

## The problem

Farm decisions depend on rainfall, temperature, soil moisture, vegetation conditions, cropping history and water availability. These signals can be difficult to bring together for an individual field, particularly when climate conditions change between seasons.

## What FutureField does

- **Field mapping and management:** Locate fields in Bangladesh, draw field boundaries and save field details and crop history.
- **Field intelligence:** Inspect field-specific environmental indicators, including rainfall, temperature, root-zone wetness, NDVI and water stress assessments.
- **Crop analysis:** Compare crop suitability using environmental conditions and farmer-provided information.
- **Rotation planner:** Explore possible crop sequences and rotation recommendations.
- **Climate insights and simulations:** Examine climate patterns and test hypothetical changes in growing conditions.
- **Data explorer:** Review environmental observations and trends for the selected field.
- **Reports, alerts, and season outcomes:** Review assessments, monitor conditions and record seasonal results.
- **Ask FutureField:** Ask questions about the selected field through an AI assistant integrated with the backend.
- **Personal and demo modes:** Authenticated users manage their own fields; demo mode provides a separate demonstration experience.

## How it works

1. Sign up or sign in through Supabase authentication.
2. Select a location in Bangladesh and draw a field boundary.
3. Enter field details, including irrigation, soil information and crop history.
4. FutureField associates the field with its location and requests environmental observations through the backend.
5. Explore field conditions, crop suitability, rotation recommendations, simulations and reports.
6. Save and revisit personal fields and seasonal decisions.

## NASA datasets and resources

FutureField uses NASA environmental observations for field-level decision support. The following table distinguishes **data products accessed by the implemented backend** from **NASA services and reference resources consulted during development**. A resource being listed does not imply that the application downloads its data.

### Datasets and APIs integrated in the backend

| Dataset / service | How FutureField uses it | Official link |
| --- | --- | --- |
| **NASA POWER** | Field-location weather and environmental observations, including temperature, precipitation, humidity, and soil wetness | [NASA POWER](https://power.larc.nasa.gov/) |
| **NASA POWER daily point API** | Retrieves time-series parameters for the selected field coordinates; this is an **API**, not a separate dataset | [Daily point API](https://power.larc.nasa.gov/api/temporal/daily/point) |
| **NASA MERRA-2-derived variables via POWER** | Soil wetness (`GWETROOT`, `GWETTOP`, `GWETPROF`) and related environmental context. FutureField accesses these through POWER rather than downloading raw MERRA-2 files | [MERRA-2](https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/) |
| **MODIS MOD13Q1 (Version 6.1)** | 250 m, 16-day NDVI observations for vegetation-condition analysis, retrieved through the ORNL DAAC MODIS subset service | [MOD13Q1 product](https://lpdaac.usgs.gov/products/mod13q1v061/) · [ORNL DAAC MODIS](https://modis.ornl.gov/) |

Examples of NASA POWER parameters used by the backend include `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `GWETROOT`, `GWETTOP`, `GWETPROF`, `QV2M`, and `CDD0`. The MODIS vegetation client requests `250m_16_days_NDVI` from **MOD13Q1**.

### Additional NASA resources referenced during development

| Dataset / resource | Role | Official link |
| --- | --- | --- |
| **MODIS MYD13Q1 (Version 6.1)** | Complementary vegetation-index product consulted as a reference; not a confirmed direct data integration | [MYD13Q1 product](https://lpdaac.usgs.gov/products/myd13q1v061/) |
| **NASA Earthdata** | Dataset discovery and documentation portal | [NASA Earthdata](https://www.earthdata.nasa.gov/) |
| **NASA AppEEARS** | Reference for geospatial Earth observation data extraction; not a confirmed direct API integration | [AppEEARS](https://appeears.earthdatacloud.nasa.gov/) |
| **NASA SMAP** | Soil-moisture dataset reference; FutureField does not directly fetch SMAP observations in the inspected backend | [SMAP](https://nsidc.org/data/smap) |
| **NASA GPM IMERG** | Satellite-precipitation dataset reference; FutureField does not directly fetch IMERG observations in the inspected backend | [GPM IMERG](https://gpm.nasa.gov/data/imerg) |

The backend includes caching, missing-data handling and source/provenance labeling. Availability depends on external services, the requested location and period and runtime configuration. Demo/synthetic data must not be presented as direct NASA observations.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Maps | Leaflet, React Leaflet |
| Visualizations and UI | Recharts, Lucide React |
| Backend | Python, FastAPI, Pydantic, HTTPX |
| Authentication and personal field storage | Supabase Auth, Supabase PostgreSQL with row-level security |
| AI assistant | Google Gemini via `google-genai` |
| Deployment | Vercel (frontend), Render (backend) |

## Repository structure

The uploaded project archive contains an outer `FutureField/` directory and a nested `FutureField/` application directory. The application code is organized as:

```text
FutureField/
├── Backend/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── data_sources/     # NASA data clients and source registry
│   │   ├── engines/          # Suitability, rotation, and simulation logic
│   │   ├── knowledge/        # Crop and regional reference data
│   │   ├── processing/       # Cleaning, aggregation, and indicators
│   │   ├── schemas/          # Pydantic models
│   │   ├── services/         # Application orchestration
│   │   └── main.py           # FastAPI application
│   ├── requirements.txt
│   └── tests/
└── Frontend/
    ├── src/
    │   ├── components/
    │   ├── context/
    │   ├── data/
    │   ├── lib/
    │   ├── api.ts
    │   └── App.tsx
    └── package.json
```

## Run locally

**Prerequisites:** Python 3.10+ (a version supporting `str | None` type hints), Node.js compatible with the included Vite version, npm and a configured Supabase project. The backend's external API integrations may require additional credentials.

### 1. Backend

From the directory containing `Backend/` and `Frontend/`:

```bash
cd Backend
python -m venv .venv
```

Activate the environment:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS / Linux
source .venv/bin/activate
```

Install dependencies and start FastAPI:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API: http://localhost:8000  
Interactive API documentation: http://localhost:8000/docs

Create `Backend/.env` for your own environment. Example **variable names** (replace placeholders locally; do not commit secrets):

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:8443
USE_MOCK_NASA=false
# Configure any Gemini API key required by the assistant service.
# Optional NASA Earthdata settings, if needed by your deployment:
# EARTHDATA_USER=
# EARTHDATA_PASS=
# EARTHDATA_TOKEN=
```

The `USE_MOCK_NASA` setting controls mock-data behavior; use `true` only when deliberately testing synthetic/demo observations. Consult `Backend/app/config.py` and the assistant service for additional runtime settings.

### 2. Frontend

Open a second terminal:

```bash
cd Frontend
npm install
```

Create `Frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Ensure this origin is permitted by the backend's `FRONTEND_ORIGINS` setting and that your Supabase authentication URL configuration supports the local and deployed URLs.

### 3. Build and test

```bash
# In Frontend/
npm run build
```

```bash
# In Backend/
pytest -q
```

These are the project's configured commands; successful execution depends on local environment and external-service configuration.

## Deployment notes

The frontend is designed to connect to a separately deployed FastAPI backend through `VITE_API_URL`. Configure the frontend's Supabase URL and publishable key in the deployment environment. Configure backend secrets and allowed frontend origins on the backend host. Never expose a Supabase service-role key, Gemini API key or NASA Earthdata password in frontend variables or the repository.

For authenticated personal fields,the backend validates user identity and uses Supabase row-level security to scope access. Supabase database tables, policies and authentication settings must be configured separately; they are not created automatically by the frontend build.

## Current scope and limitations

- Geographic selection and the included location data currently focus on **Bangladesh**.
- Crop recommendations and scenario outputs are **decision-support estimates**, not measured future yields.
- MODIS NDVI is not a daily satellite measurement; the client processes 16-day observations and handles missing dates.
- Data freshness, availability and completeness depend on NASA source latency and the configured analysis window.
- Some optional external datasets are documented as resources or potential extensions rather than verified direct integrations.
- Production email verification throughput depends on the configured Supabase email provider and rate limits.

## Acknowledgments

FutureField uses publicly available NASA Earth observation resources and open-source software. Dataset and service ownership remains with the respective providers.

---

**FutureField — Better Farm Decisions.**
