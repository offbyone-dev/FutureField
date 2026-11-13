"""
FutureField — FastAPI Application

Supports:
- Real NASA environmental data
- Supabase authentication
- Personal field management
- Field Intelligence
- Personal Field Condition Assessment
- Crop Suitability
- Rotation Planning
- Climate Insights
- Scenario Lab and Climate Simulations
- Personal Scenario Lab
- Seasonal Decision Reports
- Demo Mode
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config


# ==================================================
# CORE API ROUTERS
# ==================================================

from app.api import (
    environment,
    fields,
    intelligence,
    plan,
    rotations,
    simulation,
    suitability,
)


# ==================================================
# EXISTING UI / EXTENDED ROUTERS
# ==================================================

from app.api import (
    dashboard,
    fields_summary,
    field_intelligence_mock,
    crop_analysis,
    rotation_mock,
    scenario_lab,
    climate_insights,
    data_explorer,
    alerts_api,
    reports_api,
    season_outcomes,
    feedback,
    assistant,
)


# ==================================================
# PERSONAL AUTHENTICATED ROUTERS
# ==================================================

from app.api import (
    personal_suitability,
    personal_rotations,
    personal_climate_insights,
    personal_field_condition,
    personal_scenario_lab,
)


# ==================================================
# AUTHENTICATION / ERRORS / STORAGE
# ==================================================

from app.auth import get_current_user
from app.errors import AppError
from app.storage.seed import seed_demo_fields


# ==================================================
# APPLICATION LIFESPAN
# ==================================================

@asynccontextmanager
async def lifespan(_: FastAPI):

    # Seed demo fields only.
    # Personal fields remain in Supabase.
    seed_demo_fields()

    yield


# ==================================================
# FASTAPI APPLICATION
# ==================================================

app = FastAPI(
    title="FutureField API",
    version="0.1.0",
    description=(
        "NASA-powered agricultural decision support "
        "for field intelligence, environmental condition "
        "assessment, crop suitability, "
        "rotation planning, climate insights, "
        "scenario simulations, and seasonal decision reports."
    ),
    lifespan=lifespan,
)


# ==================================================
# CORS CONFIGURATION
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# ERROR HANDLING
# ==================================================

@app.exception_handler(AppError)
async def app_error_handler(
    _: Request,
    exc: AppError,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc)},
    )


# ==================================================
# EXISTING ROUTERS
# ==================================================

existing_routers = (
    fields,
    environment,
    intelligence,
    suitability,
    rotations,
    simulation,
    plan,
    dashboard,
    fields_summary,
    field_intelligence_mock,
    crop_analysis,
    rotation_mock,
    scenario_lab,
    climate_insights,
    data_explorer,
    alerts_api,
    reports_api,
    season_outcomes,
    feedback,
    assistant,
)

for router_module in existing_routers:
    app.include_router(router_module.router)


# ==================================================
# PERSONAL AUTHENTICATED ROUTERS
# ==================================================

# Personal Crop Suitability
app.include_router(personal_suitability.router)

# Personal Rotation Planner
app.include_router(personal_rotations.router)

# Personal Climate Insights
app.include_router(personal_climate_insights.router)

# Personal Field Condition Assessment
app.include_router(personal_field_condition.router)

# Personal Scenario Lab
app.include_router(personal_scenario_lab.router)


# ==================================================
# PERSONAL FIELD INTELLIGENCE
# ==================================================

# Registered through:
# field_intelligence_mock.router
#
# Endpoint:
# GET /personal/fields/{field_id}/intelligence
#
# Uses:
# personal_field_metrics_service.py


# ==================================================
# PERSONAL FIELD CONDITION
# ==================================================

# Registered through:
# personal_field_condition.router
#
# Endpoint:
# GET /personal/fields/{field_id}/condition
#
# Uses:
# personal_field_condition_service.py
#
# Provides:
# - Environmental condition assessment
# - Field-specific environmental indicators
# - Current Field Health Score
# - Field-specific Key Observations
# - Data availability and assessment status


# ==================================================
# PERSONAL SCENARIO LAB
# ==================================================

# Registered through:
# personal_scenario_lab.router
#
# Endpoints:
# GET /personal/fields/{field_id}/scenario-lab
# POST /personal/fields/{field_id}/scenario-lab/simulate
#
# Uses:
# personal_scenario_service.py
# personal_environment_service.py
# supabase_field_service.py
#
# Features:
# - Supabase authentication
# - Field ownership verification
# - Field-specific NASA environmental baseline
# - Rainfall change simulation
# - Temperature change simulation
# - Water availability scenarios
# - Soil recovery priority
# - Rotation strategy comparison
# - Scenario impact explanation
# - Recommended rotation strategy
#
# Demo Mode remains separate.


# ==================================================
# PERSONAL SEASONAL DECISION REPORT
# ==================================================

# Registered through:
# reports_api.router
#
# Endpoint:
# GET /personal/fields/{field_id}/report
#
# Uses:
# personal_reports_service.py
# personal_field_metrics_service.py


# ==================================================
# HEALTH ENDPOINT
# ==================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "mock_nasa": config.USE_MOCK_NASA,
        "origins": config.FRONTEND_ORIGINS,
    }


# ==================================================
# AUTHENTICATION ENDPOINT
# ==================================================

@app.get("/auth/me")
def get_my_profile(
    user=Depends(get_current_user),
):
    return {
        "id": user.id,
        "email": user.email,
        "authenticated": True,
    }