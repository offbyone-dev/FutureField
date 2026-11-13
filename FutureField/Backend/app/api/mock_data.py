"""
Central mock data store for all FutureField frontend pages.
All values match exactly what the frontend displays so every page renders correctly.
"""
import math

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
DASHBOARD = {
    "farm_name": "Green Valley Farm",
    "greeting": "Good morning, Rahim",
    "active_fields": 3,
    "total_area_ha": 24.8,
    "soil_moisture_pct": 31,
    "water_stress": "Moderate",
    "season": "Current Growing Season",
    "last_updated": "27 Sep 2026",
    "field_intelligence": {
        "field_name": "Field 01",
        "area_ha": 12.4,
        "current_crop": "Rice",
        "health_score": 72,
        "health_label": "Moderately Healthy",
        "soil_moisture": "31%",
        "rainfall": "42 mm",
        "ndvi": "0.62",
        "temperature": "31.2°C",
        "et": "4.8 mm/day",
        "water_stress": "Moderate",
    },
    "env_cards": [
        {"title": "Soil Moisture", "value": "31%", "context": "Below recent historical range"},
        {"title": "Rainfall", "value": "42 mm", "context": "18% below recent average"},
        {"title": "Vegetation Health", "value": "NDVI 0.62", "context": "Stable"},
        {"title": "Temperature", "value": "31.2°C", "context": "Above recent average"},
    ],
    "top_metrics": [
        {"label": "3 Active Fields"},
        {"label": "24.8 ha Total Area"},
        {"label": "31% Soil Moisture"},
        {"label": "Moderate Water Stress", "highlight": True},
        {"label": "Current Growing Season"},
    ],
}

# ---------------------------------------------------------------------------
# My Fields
# ---------------------------------------------------------------------------
FIELDS_SUMMARY = {
    "fields": [
        {
            "name": "Field 01",
            "area": "12.4 ha",
            "crop": "Rice",
            "condition": "Moderately Healthy",
            "moisture": "31%",
            "ndvi": "0.62",
            "stress": "Moderate",
            "lastObs": "27 Sep 2026",
            "rainfall_trend": "18% below avg",
            "temp_trend": "+1.2°C anomaly",
        },
        {
            "name": "Field 02",
            "area": "8.2 ha",
            "crop": "Fallow",
            "condition": "Healthy",
            "moisture": "45%",
            "ndvi": "0.31",
            "stress": "Low",
            "lastObs": "27 Sep 2026",
            "rainfall_trend": "On average",
            "temp_trend": "+0.3°C anomaly",
        },
        {
            "name": "Field 03",
            "area": "4.2 ha",
            "crop": "Sorghum",
            "condition": "Stressed",
            "moisture": "18%",
            "ndvi": "0.45",
            "stress": "High",
            "lastObs": "27 Sep 2026",
            "rainfall_trend": "32% below avg",
            "temp_trend": "+2.1°C anomaly",
        },
    ]
}


# ---------------------------------------------------------------------------
# Field Intelligence
# ---------------------------------------------------------------------------
def _generate_historical_chart(n: int = 30) -> list[dict]:
    """Deterministic 30-day soil moisture chart data."""
    data = []
    for i in range(n):
        current = round(40 - i * 0.5 + math.sin(i * 0.7) * 2.5, 2)
        historical = round(45 - i * 0.2, 2)
        data.append({"day": i, "current": current, "historical": historical})
    return data


FIELD_INTELLIGENCE = {
    "Field 01": {
        "field_name": "Field 01",
        "area_ha": 12.4,
        "current_crop": "Rice",
        "breadcrumb": "Green Valley Farm > Field 01 > 12.4 ha > Current: Rice",
        "condition": {
            "label": "Moderate Water Stress",
            "status": "Requires Monitoring",
            "health_score": 72,
            "health_label": "Moderately Healthy",
            "dimensions_count": 6,
        },
        "metrics": {
            "soil_moisture": "31%",
            "rainfall": "42 mm",
            "ndvi": "0.62",
            "temperature": "31.2°C",
            "et": "4.8 mm/d",
        },
        "condition_bars": [
            {"label": "Soil Moisture", "value": 78},
            {"label": "Rainfall", "value": 81},
            {"label": "Temperature", "value": 62},
            {"label": "Vegetation Health", "value": 76},
            {"label": "Drought Risk", "value": 58},
            {"label": "Water Availability", "value": 65},
        ],
        "observations": [
            "Soil moisture is below the recent historical range.",
            "Rainfall has been lower than the recent baseline.",
            "Vegetation health remains relatively stable.",
            "Higher temperatures may increase water demand.",
        ],
        "historical_chart": _generate_historical_chart(30),
        "current_value": "31%",
        "historical_context": "Below your recent historical range.",
        "data_sources": ["NASA SMAP", "NASA GPM"],
    }
}


# ---------------------------------------------------------------------------
# Crop Analysis
# ---------------------------------------------------------------------------
CROP_ANALYSIS = {
    "field": "Field 01",
    "crops": [
        {
            "name": "Maize",
            "base": 65,
            "score": 65,
            "waterReq": "Moderate",
            "duration": "90-120 Days",
            "climate": "Tolerant",
            "soilComp": "Good",
            "why": (
                "Maize scores well because the current temperature and soil moisture match its "
                "preferred growing conditions. Your emphasis on yield and heat resilience boosts its ranking."
            ),
            "factors": {
                "water": 1, "drought": 1, "heat": 2, "yield": 2,
                "profit": 2, "soil": 0, "weather": 1, "diversity": 1,
            },
        },
        {
            "name": "Lentil",
            "base": 70,
            "score": 70,
            "waterReq": "Low",
            "duration": "100-110 Days",
            "climate": "Resilient",
            "soilComp": "Excellent",
            "why": (
                "Lentil appears highly suitable under the current dry field conditions. "
                "It requires significantly less water and improves soil health."
            ),
            "factors": {
                "water": 3, "drought": 3, "heat": 0, "yield": -1,
                "profit": 0, "soil": 2, "weather": 1, "diversity": 2,
            },
        },
        {
            "name": "Rice",
            "base": 50,
            "score": 50,
            "waterReq": "High",
            "duration": "120-150 Days",
            "climate": "Sensitive",
            "soilComp": "Moderate",
            "why": (
                "Rice currently ranks lower due to its high water requirement "
                "in a period of moderate water stress."
            ),
            "factors": {
                "water": -3, "drought": -3, "heat": 1, "yield": 2,
                "profit": 1, "soil": -1, "weather": 0, "diversity": 0,
            },
        },
        {
            "name": "Wheat",
            "base": 60,
            "score": 60,
            "waterReq": "Moderate",
            "duration": "110-130 Days",
            "climate": "Moderate",
            "soilComp": "Good",
            "why": (
                "Wheat offers a balanced profile but is slightly penalized if "
                "heat resilience is prioritized."
            ),
            "factors": {
                "water": 1, "drought": 1, "heat": -1, "yield": 1,
                "profit": 1, "soil": 1, "weather": 1, "diversity": 1,
            },
        },
        {
            "name": "Potato",
            "base": 55,
            "score": 55,
            "waterReq": "High",
            "duration": "90-110 Days",
            "climate": "Sensitive",
            "soilComp": "Moderate",
            "why": (
                "Potato offers strong economic and yield potential, "
                "but carries higher climate and water risk."
            ),
            "factors": {
                "water": -1, "drought": -1, "heat": -2, "yield": 3,
                "profit": 3, "soil": -1, "weather": -1, "diversity": 1,
            },
        },
    ],
    "field_conditions": {
        "soil_moisture": "31%",
        "rainfall": "Below recent avg",
        "temperature": "Above recent avg",
        "water_stress": "Moderate",
    },
    "data_sources": ["NASA SMAP", "NASA GPM", "NASA NDVI", "Local Soil Profile", "Crop Database"],
}


# ---------------------------------------------------------------------------
# Rotation Planner
# ---------------------------------------------------------------------------
ROTATIONS_MOCK = {
    "field": "Field 01",
    "scenarios": [
        {
            "name": "Water Saver",
            "desc": "Prioritizes lower water-demand phases to reduce seasonal irrigation needs.",
            "overallScore": 82,
            "timeline": [
                {"p": "Season 1", "c": "Sorghum"},
                {"p": "Season 2", "c": "Soybean"},
                {"p": "Season 3", "c": "Cover Crop"},
                {"p": "Season 4", "c": "Rice"},
            ],
            "water": 90,
            "soil": 50,
            "climate": 60,
            "div": 70,
            "yieldS": 55,
            "why": (
                "Water Saver was generated because water saving is a high priority and the field is "
                "showing moderate water stress. Lower-water-demand phases are weighted more heavily."
            ),
        },
        {
            "name": "Soil Builder",
            "desc": "Includes a soil-improving legume phase to rebuild organic matter.",
            "overallScore": 76,
            "timeline": [
                {"p": "Season 1", "c": "Sorghum"},
                {"p": "Season 2", "c": "Cover Crop"},
                {"p": "Season 3", "c": "Soybean"},
                {"p": "Season 4", "c": "Rice"},
            ],
            "water": 60,
            "soil": 90,
            "climate": 50,
            "div": 80,
            "yieldS": 60,
            "why": (
                "Soil Builder was generated because soil health was flagged as a priority. "
                "The legume and cover crop phases improve organic matter and nitrogen fixation."
            ),
        },
        {
            "name": "Balanced",
            "desc": "Balances water, soil, climate, and yield across all rotation slots.",
            "overallScore": 79,
            "timeline": [
                {"p": "Season 1", "c": "Rice"},
                {"p": "Season 2", "c": "Soybean"},
                {"p": "Season 3", "c": "Wheat"},
                {"p": "Season 4", "c": "Cover Crop"},
            ],
            "water": 75,
            "soil": 75,
            "climate": 70,
            "div": 85,
            "yieldS": 72,
            "why": (
                "Balanced rotation was generated to optimize across all four priority dimensions equally. "
                "It provides a stable long-term rotation with moderate performance on every metric."
            ),
        },
    ],
    "available_crops": [
        {"name": "Sorghum", "water": "Low", "climate": "Tolerant", "soil": "Neutral", "duration": "90-100d"},
        {"name": "Soybean", "water": "Moderate", "climate": "Moderate", "soil": "Positive", "duration": "100-120d"},
        {"name": "Cover Crop", "water": "Low", "climate": "Resilient", "soil": "Positive", "duration": "60-90d"},
        {"name": "Rice", "water": "High", "climate": "Sensitive", "soil": "Neutral", "duration": "120-150d"},
        {"name": "Wheat", "water": "Moderate", "climate": "Moderate", "soil": "Neutral", "duration": "110-130d"},
        {"name": "Maize", "water": "Moderate", "climate": "Tolerant", "soil": "Neutral", "duration": "90-120d"},
        {"name": "Lentil", "water": "Low", "climate": "Resilient", "soil": "Positive", "duration": "100-110d"},
        {"name": "Potato", "water": "High", "climate": "Sensitive", "soil": "Moderate", "duration": "90-110d"},
    ],
}


# ---------------------------------------------------------------------------
# Scenario Lab
# ---------------------------------------------------------------------------
SCENARIO_LAB = {
    "field": "Field 01",
    "baseline": {
        "rainfall_pct": 100,
        "temperature_c": 31,
        "water_availability_pct": 100,
        "resilience": 78,
    },
    "chart_data": [
        {"year": "2026", "ws": 85, "sb": 70, "br": 75},
        {"year": "2027", "ws": 88, "sb": 75, "br": 80},
        {"year": "2028", "ws": 86, "sb": 82, "br": 84},
        {"year": "2029", "ws": 89, "sb": 88, "br": 85},
    ],
    "scenarios": ["Water Saver", "Soil Builder", "Balanced"],
    "description": (
        "Adjust rainfall, temperature, and water availability to see how each rotation "
        "scenario responds under different climate conditions."
    ),
}


# ---------------------------------------------------------------------------
# Climate Insights
# ---------------------------------------------------------------------------
def _generate_trend_chart(n: int = 30) -> list[dict]:
    """Deterministic 30-day trend chart."""
    data = []
    for i in range(n):
        current = round(40 - i * 0.3 + math.sin(i * 0.5) * 1.5, 2)
        historical = round(45 - i * 0.1, 2)
        data.append({"day": i, "current": current, "historical": historical})
    return data


CLIMATE_INSIGHTS = {
    "field": "Field 01",
    "indicators": [
        {"title": "Soil Moisture", "current": "31%", "hist": "36%", "trend": "Declining", "source": "NASA SMAP"},
        {"title": "Rainfall", "current": "42 mm", "hist": "51 mm", "trend": "Below avg", "source": "NASA GPM"},
        {"title": "Temperature", "current": "31.2°C", "hist": "29.8°C", "trend": "Above avg", "source": "NASA POWER"},
        {"title": "NDVI", "current": "0.62", "hist": "0.64", "trend": "Stable", "source": "NASA NDVI"},
        {"title": "Evapotranspiration", "current": "4.8 mm/d", "hist": "--", "trend": "Estimated", "source": "OpenET"},
    ],
    "trend_chart": _generate_trend_chart(30),
    "interpretation": [
        "Rainfall has remained below the recent historical range.",
        "Soil moisture has declined gradually over the last 30 days.",
        "Vegetation health remains relatively stable despite early heat stress.",
    ],
    "source_details": {
        "NASA SMAP": {
            "purpose": "Measures global surface soil moisture and freeze/thaw states.",
            "date_acquired": "27 Sep 2026 (04:00 UTC)",
            "coverage": "Global (Cloud-free capability)",
            "resolution": "9km grid spatial resolution",
        },
        "NASA GPM": {
            "purpose": "Measures global precipitation using a satellite constellation.",
            "date_acquired": "27 Sep 2026 (06:00 UTC)",
            "coverage": "Global (±60° latitude)",
            "resolution": "0.1° (~10 km) grid",
        },
        "NASA POWER": {
            "purpose": "Provides meteorological and solar energy data for agriculture.",
            "date_acquired": "27 Sep 2026",
            "coverage": "Global",
            "resolution": "0.5° (~50 km) grid",
        },
        "NASA NDVI": {
            "purpose": "Measures vegetation greenness and health from satellite imagery.",
            "date_acquired": "25 Sep 2026",
            "coverage": "Global (land surface)",
            "resolution": "250 m (MODIS)",
        },
        "OpenET": {
            "purpose": "Estimates evapotranspiration from satellite-based energy balance.",
            "date_acquired": "27 Sep 2026",
            "coverage": "USA and expanding globally",
            "resolution": "30 m (Landsat-based)",
        },
    },
}


# ---------------------------------------------------------------------------
# Data Explorer
# ---------------------------------------------------------------------------
DATA_EXPLORER = {
    "datasets": [
        {"name": "NASA SMAP", "description": "Soil moisture", "resolution": "9km Grid", "temporal": "Daily"},
        {"name": "NASA GPM", "description": "Precipitation", "resolution": "0.1°", "temporal": "Daily"},
        {"name": "NASA POWER", "description": "Meteorology", "resolution": "0.5°", "temporal": "Daily"},
        {"name": "NASA NDVI", "description": "Vegetation index", "resolution": "250m", "temporal": "16-day"},
        {"name": "MODIS / VIIRS", "description": "Land surface", "resolution": "500m", "temporal": "Daily"},
        {"name": "Landsat / OpenET", "description": "ET estimation", "resolution": "30m", "temporal": "Monthly"},
        {"name": "Local Soil Data", "description": "Field soil profile", "resolution": "Field-level", "temporal": "Static"},
        {"name": "Crop Database", "description": "Crop requirements", "resolution": "National", "temporal": "Annual"},
    ],
    "time_series": [
        {"month": "Jan", "val": 48.2},
        {"month": "Feb", "val": 44.1},
        {"month": "Mar", "val": 39.8},
        {"month": "Apr", "val": 36.2},
        {"month": "May", "val": 41.5},
        {"month": "Jun", "val": 52.3},
        {"month": "Jul", "val": 58.1},
        {"month": "Aug", "val": 55.4},
        {"month": "Sep", "val": 45.2},
        {"month": "Oct", "val": 40.1},
        {"month": "Nov", "val": 38.7},
        {"month": "Dec", "val": 45.6},
    ],
    "metadata": {
        "source": "NASA SMAP",
        "acquisition_date": "27 Sep 2026",
        "spatial_resolution": "9km Grid",
        "temporal_resolution": "Daily",
        "processing_status": "L4 Final",
        "data_availability": "99.8%",
    },
}


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
ALERTS = {
    "alerts": [
        {
            "id": 1,
            "title": "Water Stress",
            "desc": "Field 01 soil moisture is below its recent historical range.",
            "severity": "Moderate",
            "source": "NASA SMAP",
            "date": "27 Sep 2026",
            "unread": True,
            "field": "Field 01",
            "obs": "31% Soil Moisture",
            "hist": "Historical average for this week is 38%.",
            "monitor": (
                "Monitor soil moisture trends over the next 7 days "
                "and review irrigation availability."
            ),
        },
        {
            "id": 2,
            "title": "Rain Event",
            "desc": "Recent rainfall may affect field conditions.",
            "severity": "Info",
            "source": "NASA GPM",
            "date": "26 Sep 2026",
            "unread": True,
            "field": "Field 02",
            "obs": "42 mm accumulated",
            "hist": "Aligns with recent precipitation forecasts.",
            "monitor": "Check for potential localized waterlogging in lower field zones.",
        },
        {
            "id": 3,
            "title": "Vegetation Change",
            "desc": "NDVI has changed compared with the previous period.",
            "severity": "Low",
            "source": "NASA NDVI",
            "date": "24 Sep 2026",
            "unread": False,
            "field": "Field 01",
            "obs": "0.62 NDVI (-0.02)",
            "hist": "Slight deviation from the expected growth curve.",
            "monitor": "Review vegetation health layers in the Field Intelligence view.",
        },
    ],
    "unread_count": 2,
}


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
REPORT = {
    "farm_name": "Green Valley Farm",
    "field_name": "Field 01",
    "area_ha": 12.4,
    "current_crop": "Rice",
    "resilience_score": 78,
    "resilience_description": (
        "Overall resilience score based on modelled response to drought, heat, and "
        "structural soil conditions."
    ),
    "resilience_label": "Modelled",
    "conditions": {
        "soil_moisture": "31%",
        "rainfall": "42 mm",
        "temperature": "31.2°C",
        "ndvi": "0.62",
        "water_stress": "Moderate",
    },
    "rotation_scenarios": [
        {
            "name": "Water Saver",
            "desc": "Prioritizes lower water demand.",
            "water": 90,
            "soil": 50,
            "climate": 60,
        },
        {
            "name": "Soil Builder",
            "desc": "Prioritizes soil recovery.",
            "water": 60,
            "soil": 90,
            "climate": 50,
        },
        {
            "name": "Balanced",
            "desc": "Balances all dimensions.",
            "water": 75,
            "soil": 75,
            "climate": 70,
        },
    ],
    "uncertainties": [
        {"key": "Missing Data", "value": "Soil nitrogen not provided"},
        {"key": "Resilience Score", "value": "Modelled"},
        {"key": "Crop Timelines", "value": "Illustrative"},
    ],
    "data_sources": ["NASA SMAP", "NASA GPM", "NASA NDVI", "NASA POWER", "Local Soil Data", "Crop Database"],
}

# ---------------------------------------------------------------------------
# Season Outcomes — expected yields per crop (t/ha)
# ---------------------------------------------------------------------------
EXPECTED_YIELDS: dict[str, float] = {
    "Rice": 4.2,
    "Maize": 5.1,
    "Wheat": 3.8,
    "Potato": 22.0,
    "Lentil": 1.6,
    "Sorghum": 3.2,
}
