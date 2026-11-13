# FutureField Backend

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the development server (with auto-reload)
uvicorn app.main:app --reload
# API: http://localhost:8000
# Interactive docs: http://localhost:8000/docs

# Run the whole pipeline in the terminal (demo mode)
python -m app.demo

# Run all tests
pytest -q
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `USE_MOCK_NASA` | `true` | Skip real NASA API calls and use synthetic data |
| `FUTUREFIELD_DATA_DIR` | `<repo>/data` | Directory for JSON field/environment/plan storage |
| `FRONTEND_ORIGINS` | `http://localhost:5173,http://localhost:8443,...` | Comma-separated CORS origins |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/fields` | List all fields |
| POST | `/fields` | Create a field |
| GET | `/fields/{id}` | Get a field |
| PUT | `/fields/{id}` | Replace a field (full update) |
| PATCH | `/fields/{id}` | Update a field |
| DELETE | `/fields/{id}` | Delete a field |
| GET | `/fields/{id}/environment` | Get environmental data (NASA/mock) |
| GET | `/fields/{id}/intelligence` | Get field condition analysis |
| POST | `/fields/{id}/suitability` | Run crop suitability scoring |
| POST | `/fields/{id}/rotations` | Generate rotation scenarios |
| POST | `/fields/{id}/simulate` | Run a what-if scenario |
| POST | `/fields/{id}/plan` | Build a farm plan from a rotation |
| GET | `/plans/{id}` | Get a previously built plan |
| POST | `/plans/{id}/outcome` | Save post-season outcome |
| GET | `/plans/{id}/outcome` | Get a saved outcome |
| GET | `/crops` | List all crops in the knowledge base |

## Data Flow

```
POST/GET endpoint -> api/ (validation only)
  -> services/*  (orchestration)
       pipeline.build_condition(field_id, simulation?)      <- shared by suitability, rotation, simulation
         field_service.get_field
         environment_service.get_environment
            registry.fetch_with_fallback (cache -> NASA POWER -> mock)
            cleaning -> aggregation -> indicators -> normalization -> stored EnvironmentalData
         [simulation.apply_simulation on indicators, only for what-if]
         field_intelligence.build_field_condition  -> FieldCondition
       suitability.rank_crops / rotation.rank_rotations   (pure engines)
       explain.explain_terms                              (reasons from components)
```

## Known Limitations / TODOs

See `TODO(inside)` comments throughout the codebase:

| # | File | What to implement |
|---|------|-------------------|
| 1 | `data_sources/nasa_power.py` | Verify dataset layout against official docs |
| 2 | `processing/cleaning.py` | Unit conversion, interpolation for long gaps |
| 3 | `processing/aggregation.py` | Long-term baseline for anomaly detection |
| 4 | `processing/indicators.py` | Crop-specific base temperature, rainfall variability |
| 5 | `engines/field_intelligence.py` | Refine score thresholds, flood/waterlogging flags |
| 6 | `knowledge/crops.json` | Replace PLACEHOLDER thresholds with cited agronomic data |
| 7 | `engines/suitability.py` | Better water/soil/risk fit functions |
| 8 | `engines/rotation.py` | Disease-break rules, season-window compatibility |
| 9 | `engines/simulation.py` | Apply deltas to daily series instead of aggregates |
| 10 | `services/plan_service.py` | Real sowing windows from calendar months |
| 11 | `utils/geo.py` | Shapely validation for concave/self-intersecting polygons |

> **Mock data note:** When `USE_MOCK_NASA=true` (the default), all environmental
> data is synthetic and deterministic for the field's lat/lon. Quality scores are
> capped at 0.6 to communicate that mock data is less reliable than real NASA data.
