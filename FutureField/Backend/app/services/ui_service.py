"""Build farmer-facing payloads from stored fields + NASA-backed engines."""
from datetime import date, datetime
from typing import Any

from app import config
from app.knowledge.loader import crops_by_id, load_crops, load_lookups
from app.schemas.analysis import Priorities, RotationRequest, SimulationParams, SuitabilityRequest
from app.schemas.field import FieldOut
from app.services import field_service, pipeline, rotation_service, suitability_service
from app.storage import json_store

SEASON_LABELS = ["Current", "Next", "Year 2", "Year 3"]
WATER_LABEL = {900: "High", 600: "Moderate", 500: "Moderate", 450: "Moderate", 400: "Low", 320: "Low", 300: "Low", 280: "Low"}


def resolve_field(field_id: str | None) -> FieldOut:
    fields = field_service.list_fields()
    if not fields:
        raise RuntimeError("No fields are available")
    if field_id:
        for f in fields:
            if f.id == field_id or f.name == field_id:
                return f
    return fields[0]


def _health(cond) -> tuple[int, str]:
    score = round(100 * (
        0.28 * cond.water_score + 0.22 * cond.heat_score +
        0.22 * cond.soil_score + 0.18 * cond.vegetation_score + 0.10 * cond.confidence
    ))
    if score >= 80:
        return score, "Healthy"
    if score >= 60:
        return score, "Moderately Healthy"
    return score, "Stressed"


def _stress(cond) -> str:
    if "drought_risk" in cond.flags or cond.water_score < 0.35:
        return "High"
    if cond.water_score < 0.65:
        return "Moderate"
    return "Low"


def _obs_date(env) -> str:
    try:
        return datetime.fromisoformat(str(env.fetched_at).replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:
        return date.today().strftime("%d %b %Y")


def _metrics(field: FieldOut, env, cond) -> dict[str, str]:
    ind = env.indicators
    sm = ind.get("soil_moisture_latest_pct", ind.get("soil_moisture_pct"))
    if sm is None:
        sm = round(cond.water_score * 45, 1)
    ndvi = ind.get("ndvi_latest", ind.get("ndvi_mean", cond.vegetation_score))
    return {
        "soil_moisture": f"{sm:.0f}%",
        "rainfall": f"{ind.get('rain_total_mm', cond.rain_total_mm):.0f} mm",
        "ndvi": f"{float(ndvi):.2f}",
        "temperature": f"{ind.get('mean_temp_c', cond.mean_temp_c):.1f}°C",
        "et": f"{ind.get('et_mm_per_day', 0):.1f} mm/d",
        "water_stress": _stress(cond),
    }


def _trend_text(current: float, baseline: float, unit: str = "%") -> str:
    if baseline == 0:
        return "On average"
    delta = (current - baseline) / abs(baseline) * 100
    if abs(delta) < 5:
        return "On average"
    direction = "above" if delta > 0 else "below"
    return f"{abs(delta):.0f}% {direction} avg"


def _series_values(env, key: str) -> list[float]:
    daily = env.daily or {}
    return [float(v) for v in daily.get(key, [])]


def _chart(env, key: str, scale: float = 1.0, last: int = 30) -> list[dict]:
    vals = _series_values(env, key)
    if not vals:
        return [{"day": i, "current": 0, "historical": 0} for i in range(last)]
    mean = sum(vals) / len(vals)
    window = vals[-last:]
    return [
        {"day": i, "current": round(v * scale, 2), "historical": round(mean * scale, 2)}
        for i, v in enumerate(window)
    ]


def _location(field: FieldOut) -> str:
    parts = [p for p in (field.district, field.division, "Bangladesh") if p]
    return ", ".join(parts)


def dashboard(field_id: str | None = None) -> dict:
    fields = field_service.list_fields()
    field = resolve_field(field_id)
    _, env, cond = pipeline.build_condition(field.id)
    health, label = _health(cond)
    metrics = _metrics(field, env, cond)
    sm = float(str(metrics["soil_moisture"]).replace("%", "") or 0)
    hour = datetime.now().hour
    greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"
    total_area = round(sum(f.area_ha for f in fields), 1)
    return {
        "farm_name": config.FARM_NAME,
        "greeting": greeting,
        "active_fields": len(fields),
        "total_area_ha": total_area,
        "soil_moisture_pct": sm,
        "water_stress": metrics["water_stress"],
        "season": "Current Growing Season",
        "last_updated": _obs_date(env),
        "selected_field_id": field.id,
        "data_source": env.source,
        "data_sources": env.sources,
        "field_intelligence": {
            "field_id": field.id,
            "field_name": field.name,
            "area_ha": field.area_ha,
            "current_crop": field.current_crop or "Unspecified",
            "health_score": health,
            "health_label": label,
            "soil_moisture": metrics["soil_moisture"],
            "rainfall": metrics["rainfall"],
            "ndvi": metrics["ndvi"],
            "temperature": metrics["temperature"],
            "et": metrics["et"],
            "water_stress": metrics["water_stress"],
            "location": _location(field),
        },
        "env_cards": [
            {"title": "Soil Moisture", "value": metrics["soil_moisture"],
             "context": "NASA POWER root-zone wetness (GWETROOT)"},
            {"title": "Rainfall", "value": metrics["rainfall"],
             "context": "NASA POWER precipitation (PRECTOTCORR)"},
            {"title": "Vegetation Health", "value": f"NDVI {metrics['ndvi']}",
             "context": "NASA MODIS MOD13Q1"},
            {"title": "Temperature", "value": metrics["temperature"],
             "context": "NASA POWER 2-metre air temperature"},
        ],
        "fields": [
            {
                "id": f.id, "name": f.name, "area_ha": f.area_ha,
                "current_crop": f.current_crop, "division": f.division,
                "district": f.district, "boundary": f.boundary,
                "centroid_lat": f.centroid_lat, "centroid_lon": f.centroid_lon,
            }
            for f in fields
        ],
    }


def fields_summary() -> dict:
    rows = []
    for field in field_service.list_fields():
        try:
            _, env, cond = pipeline.build_condition(field.id)
            health, label = _health(cond)
            metrics = _metrics(field, env, cond)
            rain_vals = _series_values(env, "rain")
            temp_vals = [(a + b) / 2 for a, b in zip(_series_values(env, "tmax"), _series_values(env, "tmin"))]
            rain_now = sum(rain_vals[-30:]) if rain_vals else 0
            rain_base = (sum(rain_vals) / max(len(rain_vals), 1)) * 30 if rain_vals else 1
            temp_now = sum(temp_vals[-30:]) / 30 if len(temp_vals) >= 30 else (sum(temp_vals) / max(len(temp_vals), 1) if temp_vals else 0)
            temp_base = sum(temp_vals) / max(len(temp_vals), 1) if temp_vals else temp_now
            rows.append({
                "id": field.id,
                "name": field.name,
                "area": f"{field.area_ha:.1f} ha",
                "area_ha": field.area_ha,
                "crop": field.current_crop or "Unspecified",
                "condition": label,
                "moisture": metrics["soil_moisture"],
                "ndvi": metrics["ndvi"],
                "stress": metrics["water_stress"],
                "lastObs": _obs_date(env),
                "rainfall_trend": _trend_text(rain_now, rain_base),
                "temp_trend": f"{temp_now - temp_base:+.1f}°C anomaly",
                "division": field.division,
                "district": field.district,
                "boundary": field.boundary,
                "centroid_lat": field.centroid_lat,
                "centroid_lon": field.centroid_lon,
            })
        except Exception as exc:  # noqa: BLE001
            rows.append({
                "id": field.id, "name": field.name, "area": f"{field.area_ha:.1f} ha",
                "area_ha": field.area_ha, "crop": field.current_crop or "Unspecified",
                "condition": "Pending", "moisture": "—", "ndvi": "—", "stress": "—",
                "lastObs": "—", "rainfall_trend": str(exc), "temp_trend": "",
                "division": field.division, "district": field.district,
                "boundary": field.boundary,
                "centroid_lat": field.centroid_lat, "centroid_lon": field.centroid_lon,
            })
    return {"fields": rows, "farm_name": config.FARM_NAME}


def field_intelligence(field_id: str | None = None) -> dict:
    field = resolve_field(field_id)
    _, env, cond = pipeline.build_condition(field.id)
    health, label = _health(cond)
    metrics = _metrics(field, env, cond)
    stress = metrics["water_stress"]
    observations = []
    if "drought_risk" in cond.flags:
        observations.append("Soil moisture and dry-spell length point to drought risk.")
    if cond.water_score < 0.65:
        observations.append("Water supply is below a comfortable range for high-water crops.")
    else:
        observations.append("Seasonal water supply is within a workable range.")
    if "heat_stress" in cond.flags:
        observations.append("Several hot days (Tmax > 35°C) were observed in the NASA POWER record.")
    else:
        observations.append("Heat stress days remain limited in the current window.")
    if env.indicators.get("ndvi_trend", 0) >= 0:
        observations.append("Vegetation health is stable or improving in the NASA NDVI series.")
    else:
        observations.append("Vegetation index has been declining over the analysis window.")
    if env.source == "mock":
        observations.append("Live NASA fetch was unavailable, so synthetic climate data was used.")
    bars = [
        {"label": "Soil Moisture", "value": round(env.normalized.get("soil_moisture_pct", cond.water_score) * 100)},
        {"label": "Rainfall", "value": round(env.normalized.get("rain_total_mm", 0) * 100)},
        {"label": "Temperature", "value": round(cond.heat_score * 100)},
        {"label": "Vegetation Health", "value": round(cond.vegetation_score * 100)},
        {"label": "Drought Risk", "value": round((1 - cond.water_score) * 100)},
        {"label": "Water Availability", "value": round(cond.water_score * 100)},
    ]
    return {
        "field_id": field.id,
        "field_name": field.name,
        "area_ha": field.area_ha,
        "current_crop": field.current_crop or "Unspecified",
        "farm_name": config.FARM_NAME,
        "location": _location(field),
        "boundary": field.boundary,
        "centroid_lat": field.centroid_lat,
        "centroid_lon": field.centroid_lon,
        "condition": {
            "label": f"{stress} Water Stress",
            "status": "Requires Monitoring" if stress != "Low" else "Stable",
            "health_score": health,
            "health_label": label,
            "dimensions_count": 6,
        },
        "metrics": metrics,
        "condition_bars": bars,
        "observations": observations,
        "historical_chart": _chart(env, "soil_moisture", 100),
        "current_value": metrics["soil_moisture"],
        "historical_context": "Compared with the mean of the NASA POWER window.",
        "data_sources": env.sources or ["NASA POWER"],
        "data_quality": env.quality_score,
    }


def _water_req(mm: float) -> str:
    if mm >= 700:
        return "High"
    if mm >= 450:
        return "Moderate"
    return "Low"


def _climate_label(tol: float) -> str:
    if tol >= 0.7:
        return "Resilient"
    if tol >= 0.45:
        return "Tolerant"
    return "Sensitive"


def _soil_label(fit: float) -> str:
    if fit >= 0.8:
        return "Excellent"
    if fit >= 0.6:
        return "Good"
    return "Moderate"


def crop_suitability(field_id: str | None, priorities: dict | None = None) -> dict:
    field = resolve_field(field_id)
    p = priorities or {}
    req = SuitabilityRequest(priorities=Priorities(
        water=float(p.get("water", 50)) / 100,
        yield_potential=float(p.get("yield", p.get("yield_", 50))) / 100,
        soil_health=float(p.get("soil", 50)) / 100,
        risk=float(p.get("drought", p.get("weather", 50))) / 100,
    ))
    result = suitability_service.run_suitability(field.id, req)
    _, env, cond = pipeline.build_condition(field.id)
    metrics = _metrics(field, env, cond)
    crops_kb = {c.id: c for c in load_crops()}
    crops = []
    for row in result.results:
        crop = crops_kb[row.crop_id]
        why_bits = [item.text for item in row.explanation]
        crops.append({
            "id": row.crop_id,
            "name": row.crop_name,
            "base": round(row.total_score),
            "score": round(row.total_score),
            "waterReq": _water_req(crop.water_need_mm),
            "duration": f"{crop.growth_days-10}-{crop.growth_days+10} Days",
            "climate": _climate_label(crop.drought_tolerance),
            "soilComp": _soil_label(row.components.get("soil", 0.5)),
            "why": " ".join(why_bits) or row.not_recommended_reason or "Scored from NASA field conditions and crop requirements.",
            "recommended": row.recommended,
            "factors": {
                "water": round((row.components.get("water", 0.5) - 0.5) * 6),
                "drought": round((crop.drought_tolerance - 0.5) * 6),
                "heat": round((row.components.get("temp", 0.5) - 0.5) * 6),
                "yield": round((crop.yield_index - 0.5) * 6),
                "profit": round((crop.yield_index - 0.45) * 6),
                "soil": round((row.components.get("soil", 0.5) - 0.5) * 6),
                "weather": round((row.components.get("risk", 0.5) - 0.5) * 6),
                "diversity": 1 if crop.category == "legume" else 0,
            },
        })
    return {
        "field_name": field.name,
        "field_id": field.id,
        "crops": crops,
        "field_conditions": {
            "soil_moisture": metrics["soil_moisture"],
            "rainfall": metrics["rainfall"],
            "temperature": metrics["temperature"],
            "water_stress": metrics["water_stress"],
        },
        "data_sources": env.sources or [result.data_source],
        "data_quality": result.data_quality,
    }


def rotations(field_id: str | None, priorities: dict | None = None) -> dict:
    field = resolve_field(field_id)
    p = priorities or {}
    water = float(p.get("water_saving", 40))
    soil = float(p.get("soil_health", 30))
    climate = float(p.get("climate_resilience", 20))
    yld = float(p.get("yield_productivity", 10))
    total = water + soil + climate + yld or 100
    req = RotationRequest(priorities=Priorities(
        water=water / total, soil_health=soil / total,
        risk=climate / total, yield_potential=yld / total,
    ), top_n=5, n_slots=3, limit=3)
    result = rotation_service.run_rotations(field.id, req)
    _, env, cond = pipeline.build_condition(field.id)
    metrics = _metrics(field, env, cond)
    names = ["Water Saver", "Soil Builder", "Balanced"]
    descs = [
        "Lower water demand sequence for the current NASA rainfall window.",
        "Legume-forward sequence that builds soil after the current crop.",
        "Balances yield, climate risk, and water load.",
    ]
    scenarios = []
    for i, rot in enumerate(result.rotations):
        timeline = [{"p": SEASON_LABELS[j], "c": name} for j, name in enumerate(rot.crop_names)]
        why = " ".join(item.text for item in rot.score.explanation)
        scenarios.append({
            "name": names[i] if i < len(names) else f"Scenario {i+1}",
            "desc": descs[i] if i < len(descs) else "Generated from your field conditions.",
            "overallScore": round(rot.score.total),
            "timeline": timeline,
            "water": round(rot.score.water_impact * 100),
            "soil": round(rot.score.soil_impact * 100),
            "climate": round(rot.score.resilience * 100),
            "div": round(len(set(rot.crop_ids)) / max(len(rot.crop_ids), 1) * 100),
            "yieldS": round(rot.score.yield_score * 100),
            "why": why,
            "crop_ids": rot.crop_ids,
        })
    available = []
    for crop in load_crops():
        available.append({
            "name": crop.name,
            "water": _water_req(crop.water_need_mm),
            "climate": _climate_label(crop.drought_tolerance),
            "soil": "Positive" if crop.soil_effect > 0 else "Neutral",
            "duration": f"{crop.growth_days}d",
        })
    return {
        "field_name": field.name,
        "field_id": field.id,
        "area_ha": field.area_ha,
        "current_crop": field.current_crop or "Unspecified",
        "farm_name": config.FARM_NAME,
        "soil": field.soil.texture.replace("_", " ").title(),
        "irrigation": field.irrigation_type.title(),
        "scenarios": scenarios,
        "available_crops": available,
        "field_conditions": metrics,
        "data_sources": env.sources,
    }


def scenario_lab(field_id: str | None, params: dict | None = None) -> dict:
    field = resolve_field(field_id)
    params = params or {}
    rainfall_pct = float(params.get("rainfall_pct", 0))
    temp_delta = float(params.get("temperature_delta", params.get("temperature_delta_c", 0)))
    water_avail = str(params.get("water_availability", "Medium"))
    water_map = {"High": 10, "Medium": 0, "Low": -30}
    sim = SimulationParams(
        rainfall_pct=rainfall_pct,
        temperature_delta_c=temp_delta,
        water_availability_pct=float(water_map.get(water_avail, 0)),
    ) if (rainfall_pct or temp_delta or water_avail != "Medium") else None
    _, env, base_cond = pipeline.build_condition(field.id)
    _, _, sim_cond = pipeline.build_condition(field.id, sim)
    base_health, _ = _health(base_cond)
    sim_health, _ = _health(sim_cond)
    metrics = _metrics(field, env, base_cond)
    req = RotationRequest(priorities=Priorities(), top_n=4, n_slots=3, limit=3)
    base_rots = rotation_service.run_rotations(field.id, req).rotations
    sim_req = RotationRequest(priorities=Priorities(), simulation=sim, top_n=4, n_slots=3, limit=3)
    sim_rots = rotation_service.run_rotations(field.id, sim_req).rotations if sim else base_rots

    def _pts(rots, year_shift: int) -> dict:
        keys = ["ws", "sb", "br"]
        out = {"year": str(date.today().year + year_shift)}
        for i, k in enumerate(keys):
            if i < len(rots):
                out[k] = round(rots[i].score.total)
            else:
                out[k] = 70
        return out

    chart = [
        _pts(base_rots, 0),
        _pts(sim_rots, 1),
        _pts(sim_rots, 2),
        _pts(sim_rots, 3),
    ]
    bits = []
    if rainfall_pct < 0:
        bits.append("Lower rainfall increases modelled water stress for high-water crops.")
    if temp_delta > 0:
        bits.append("Higher temperature raises evapotranspiration and heat-stress flags.")
    if water_avail == "Low":
        bits.append("Reduced irrigation water lowers the modelled supply for rainfed-sensitive sequences.")
    if not bits:
        bits.append("NASA POWER baseline is shown. Change rainfall, temperature, or water availability to stress-test rotations.")
    return {
        "field_name": field.name,
        "field_id": field.id,
        "baseline": {
            "rainfall_pct": 100,
            "temperature_c": round(base_cond.mean_temp_c, 1),
            "water_availability_pct": 100,
            "resilience": base_health,
        },
        "scenario": {
            "rainfall_pct": 100 + rainfall_pct,
            "temperature_c": round(sim_cond.mean_temp_c, 1),
            "water_availability_pct": {"High": "110%", "Medium": "100%", "Low": "70%"}.get(water_avail, "100%"),
            "resilience": sim_health,
        },
        "chart_data": chart,
        "scenarios": [s.crop_names for s in base_rots],
        "explanation": " ".join(bits),
        "metrics": metrics,
        "data_sources": env.sources,
    }


def climate_insights(field_id: str | None = None) -> dict:
    field = resolve_field(field_id)
    _, env, cond = pipeline.build_condition(field.id)
    metrics = _metrics(field, env, cond)
    rain = _series_values(env, "rain")
    sm = _series_values(env, "soil_moisture")
    ndvi = _series_values(env, "ndvi")
    tmax = _series_values(env, "tmax")
    rain_now = sum(rain[-30:]) if rain else env.indicators.get("rain_total_mm", 0)
    rain_hist = (sum(rain) / max(len(rain), 1)) * 30 if rain else rain_now
    sm_now = (sm[-1] * 100) if sm else float(str(metrics["soil_moisture"]).replace("%", "") or 0)
    sm_hist = (sum(sm) / max(len(sm), 1) * 100) if sm else sm_now
    ndvi_now = ndvi[-1] if ndvi else float(metrics["ndvi"])
    ndvi_hist = sum(ndvi) / max(len(ndvi), 1) if ndvi else ndvi_now
    temp_now = tmax[-1] if tmax else cond.mean_temp_c
    temp_hist = sum(tmax) / max(len(tmax), 1) if tmax else temp_now
    interpretation = [
        f"Rainfall over the last 30 days is {rain_now:.0f} mm versus a window average of {rain_hist:.0f} mm.",
        f"Root-zone soil wetness is {sm_now:.0f}% compared with a {sm_hist:.0f}% window mean.",
        f"NDVI is {ndvi_now:.2f} (NASA MODIS) with a seasonal mean of {ndvi_hist:.2f}.",
    ]
    acquired = _obs_date(env)
    return {
        "field_name": field.name,
        "field_id": field.id,
        "indicators": [
            {"title": "Soil Moisture", "current": f"{sm_now:.0f}%", "hist": f"{sm_hist:.0f}%",
             "trend": "Declining" if sm_now < sm_hist else "Stable", "source": "NASA POWER GWETROOT"},
            {"title": "Rainfall", "current": f"{rain_now:.0f} mm", "hist": f"{rain_hist:.0f} mm",
             "trend": "Below avg" if rain_now < rain_hist else "On/above avg", "source": "NASA POWER"},
            {"title": "Temperature", "current": f"{temp_now:.1f}°C", "hist": f"{temp_hist:.1f}°C",
             "trend": "Above avg" if temp_now > temp_hist else "Near average", "source": "NASA POWER"},
            {"title": "NDVI", "current": f"{ndvi_now:.2f}", "hist": f"{ndvi_hist:.2f}",
             "trend": "Stable" if abs(ndvi_now - ndvi_hist) < 0.05 else "Changing", "source": "NASA MODIS NDVI"},
            {"title": "Evapotranspiration", "current": metrics["et"], "hist": "—",
             "trend": "Estimated", "source": "Hargreaves from NASA POWER"},
        ],
        "trend_chart": _chart(env, "soil_moisture", 100),
        "interpretation": interpretation,
        "source_details": {
            "NASA POWER GWETROOT": {"purpose": "Root-zone soil wetness at ~0.5° from NASA POWER.",
                                    "date_acquired": acquired, "coverage": "Global", "resolution": "~50 km"},
            "NASA POWER": {"purpose": "Daily rainfall and temperature for the field centroid.",
                           "date_acquired": acquired, "coverage": "Global", "resolution": "~50 km"},
            "NASA MODIS NDVI": {"purpose": "16-day vegetation index interpolated to daily.",
                                "date_acquired": acquired, "coverage": "Global land", "resolution": "250 m"},
            "Hargreaves from NASA POWER": {"purpose": "Reference ET estimated from Tmax/Tmin.",
                                           "date_acquired": acquired, "coverage": "Field point", "resolution": "Daily"},
        },
        "data_sources": env.sources,
    }


def data_explorer(field_id: str | None = None, dataset: str | None = None) -> dict:
    field = resolve_field(field_id)
    _, env, _ = pipeline.build_condition(field.id)
    monthly = env.monthly or {}
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    series = []
    for key, row in monthly.items():
        m = int(key[5:7])
        val = row.get("soil_moisture_pct", row.get("rain_mm", row.get("tmean_c", 0)))
        if dataset and "rain" in dataset.lower():
            val = row.get("rain_mm", val)
        elif dataset and "temp" in dataset.lower():
            val = row.get("tmean_c", val)
        elif dataset and "ndvi" in dataset.lower():
            val = row.get("ndvi", 0) * 100
        series.append({"month": months[m - 1], "val": val, "key": key})
    datasets = [
        {"name": "NASA POWER soil moisture", "id": "soil"},
        {"name": "NASA POWER rainfall", "id": "rain"},
        {"name": "NASA POWER temperature", "id": "temp"},
        {"name": "NASA MODIS NDVI", "id": "ndvi"},
    ]
    return {
        "field_name": field.name,
        "field_id": field.id,
        "boundary": field.boundary,
        "centroid_lat": field.centroid_lat,
        "centroid_lon": field.centroid_lon,
        "division": field.division,
        "district": field.district,
        "datasets": datasets,
        "time_series": series,
        "metadata": {
            "source": dataset or "NASA POWER",
            "acquisition_date": _obs_date(env),
            "spatial_resolution": "~50 km (POWER) / 250 m (MODIS)",
            "temporal_resolution": "Daily",
            "processing_status": env.source,
            "data_availability": f"{round(env.quality_score * 100)}%",
        },
        "data_sources": env.sources,
    }


def alerts(field_id: str | None = None) -> dict:
    stored = json_store.load("alerts", "state") or {"archived": [], "read": []}
    items = []
    aid = 1
    targets = [resolve_field(field_id)] if field_id else field_service.list_fields()
    for field in targets:
        _, env, cond = pipeline.build_condition(field.id)
        metrics = _metrics(field, env, cond)
        if cond.water_score < 0.65:
            items.append({
                "id": aid, "title": "Water Stress",
                "desc": f"{field.name} soil moisture is below a comfortable range.",
                "severity": "Moderate" if cond.water_score >= 0.4 else "High",
                "source": "NASA POWER GWETROOT", "date": _obs_date(env),
                "unread": aid not in stored.get("read", []),
                "field_name": field.name, "field_id": field.id,
                "obs": metrics["soil_moisture"] + " soil moisture",
                "hist": f"Water score {cond.water_score:.2f} from NASA POWER indicators.",
                "monitor": "Watch rainfall and irrigation over the next 7 days.",
            })
            aid += 1
        if "heat_stress" in cond.flags:
            items.append({
                "id": aid, "title": "Temperature",
                "desc": f"Hot days were recorded for {field.name}.",
                "severity": "Low", "source": "NASA POWER", "date": _obs_date(env),
                "unread": aid not in stored.get("read", []),
                "field_name": field.name, "field_id": field.id,
                "obs": metrics["temperature"],
                "hist": f"{env.indicators.get('heat_stress_days', 0):.0f} days above 35°C.",
                "monitor": "Review heat-tolerant crops in Crop Analysis.",
            })
            aid += 1
        rain_vals = _series_values(env, "rain")
        if rain_vals and sum(rain_vals[-3:]) > 40:
            items.append({
                "id": aid, "title": "Rain Event",
                "desc": f"Recent rainfall may change conditions on {field.name}.",
                "severity": "Info", "source": "NASA POWER", "date": _obs_date(env),
                "unread": aid not in stored.get("read", []),
                "field_name": field.name, "field_id": field.id,
                "obs": f"{sum(rain_vals[-3:]):.0f} mm in 3 days",
                "hist": "Short-term accumulation from NASA POWER PRECTOTCORR.",
                "monitor": "Check for waterlogging on poorly drained soils.",
            })
            aid += 1
        if env.indicators.get("ndvi_trend", 0) < 0:
            items.append({
                "id": aid, "title": "Vegetation Change",
                "desc": f"NDVI is declining on {field.name}.",
                "severity": "Low", "source": "NASA MODIS NDVI", "date": _obs_date(env),
                "unread": aid not in stored.get("read", []),
                "field_name": field.name, "field_id": field.id,
                "obs": f"NDVI {metrics['ndvi']}",
                "hist": "Negative slope in the MODIS series.",
                "monitor": "Compare with Crop Analysis and recent rainfall.",
            })
            aid += 1
    archived = set(stored.get("archived", []))
    items = [a for a in items if a["id"] not in archived]
    return {"alerts": items, "unread_count": sum(1 for a in items if a["unread"])}


def update_alerts(action: str, alert_id: int | None = None) -> dict:
    stored = json_store.load("alerts", "state") or {"archived": [], "read": []}
    if action == "read" and alert_id is not None:
        stored.setdefault("read", []).append(alert_id)
    elif action == "read-all":
        data = alerts()
        stored["read"] = [a["id"] for a in data["alerts"]]
    elif action == "archive" and alert_id is not None:
        stored.setdefault("archived", []).append(alert_id)
    json_store.save("alerts", "state", stored)
    return alerts()


def report(field_id: str | None = None) -> dict:
    """Legacy report endpoint; never expose demo/local analysis as personal data.

    Authenticated farmer reports are served by
    GET /personal/fields/{field_id}/report via personal_reports_service.
    """
    return {
        "status": "personal_endpoint_required",
        "message": (
            "For an authenticated field-specific Seasonal Decision Report, "
            "use GET /personal/fields/{field_id}/report."
        ),
        "field_id": field_id,
        "farm_name": config.FARM_NAME,
        "field_name": None,
        "area_ha": None,
        "current_crop": None,
        "location": None,
        "resilience_score": None,
        "resilience_label": "Not assessed",
        "conditions": {
            "soil_moisture": "—",
            "rainfall": "—",
            "temperature": "—",
            "ndvi": "—",
            "water_stress": "Not assessed",
        },
        "rotation_scenarios": [],
        "uncertainties": [],
        "data_sources": [],
    }


def lookups() -> dict:
    crops = [{"id": c.id, "name": c.name} for c in load_crops()]
    extra = [{"id": "fallow", "name": "Fallow"}, {"id": "cover", "name": "Cover crop"}]
    data = load_lookups()
    return {**data, "crops": crops + extra, "farm_name": config.FARM_NAME}


def expected_yield(crop_name: str) -> float:
    by_name = {c.name.lower(): c for c in load_crops()}
    crop = by_name.get((crop_name or "").lower())
    if not crop:
        return 3.5
    return round(1.5 + crop.yield_index * 4.0, 1)


def save_outcome(payload: dict) -> dict:
    field = resolve_field(payload.get("field") or payload.get("field_id"))
    crop = payload.get("crop_planted") or field.current_crop or "Unspecified"
    expected = expected_yield(crop)
    actual = payload.get("actual_yield_t_ha")
    diff = round(float(actual) - expected, 2) if actual is not None and actual != "" else None
    feedback_id = datetime.now().strftime("%Y%m%d%H%M%S")
    record = {
        "feedback_id": feedback_id,
        "field_name": field.name,
        "field_id": field.id,
        "season": payload.get("season") or str(date.today().year),
        "crop_planted": crop,
        "expected_yield_t_ha": expected,
        "actual_yield_t_ha": actual,
        "difference_t_ha": diff,
        "exceeded_target": diff >= 0 if diff is not None else None,
        "water_used": payload.get("water_used") or "",
        "weather_event": payload.get("weather_event") or "",
        "match_experience": payload.get("match_experience") or "",
        "farmer_note": payload.get("farmer_note") or "",
        "recorded_at": datetime.now().isoformat(),
    }
    json_store.save("outcomes", feedback_id, record)
    return {
        "status": "recorded",
        "message": "Outcome successfully logged.",
        **record,
    }


def list_outcomes(field_id: str | None = None) -> dict:
    rows = json_store.list_all("outcomes")
    if field_id:
        field = resolve_field(field_id)
        rows = [r for r in rows if r.get("field_id") == field.id or r.get("field") == field.name]
    rows.sort(key=lambda r: r.get("recorded_at", ""), reverse=True)
    return {"outcomes": rows, "count": len(rows)}


def save_feedback(payload: dict) -> dict:
    field = resolve_field(payload.get("field") or payload.get("field_id"))
    feedback_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    record = {
        "feedback_id": feedback_id,
        "field_name": field.name,
        "field_id": field.id,
        "crop": payload.get("crop") or "",
        "helpful": payload.get("helpful"),
        "reason": payload.get("reason") or "",
        "note": payload.get("note") or "",
        "recorded_at": datetime.now().isoformat(),
    }
    json_store.save("feedback", feedback_id, record)
    return {"status": "recorded", "message": "Thank you for your feedback.", "feedback_id": feedback_id}


def assistant(question: str, field_id: str | None = None) -> dict:
    field = resolve_field(field_id)
    intel = field_intelligence(field.id)
    crops = crop_suitability(field.id)
    rots = rotations(field.id)
    metrics = intel["metrics"]
    ranked = crops.get("crops") or []
    top = ranked[0] if ranked else None
    low = ranked[-1] if ranked else None
    q = (question or "").strip().lower()
    sources = intel.get("data_sources") or ["NASA POWER", "NASA MODIS NDVI"]

    if not q:
        answer = (
            f"{field.name} currently shows {metrics['water_stress'].lower()} water stress, "
            f"soil moisture {metrics['soil_moisture']}, and NDVI {metrics['ndvi']}."
        )
    elif "water" in q and ("less" in q or "saving" in q or "low" in q):
        dry = [c for c in ranked if c.get("waterReq") == "Low"]
        names = ", ".join(c["name"] for c in dry[:3]) or "sorghum and lentil"
        answer = (
            f"For {field.name}, lower-water options include {names}. "
            f"Seasonal rainfall is {metrics['rainfall']} with {metrics['water_stress'].lower()} water stress."
        )
    elif "rice" in q:
        rice = next((c for c in ranked if c["name"].lower() == "rice"), None)
        answer = rice["why"] if rice else "Rice is scored from NASA rainfall, temperature, and soil texture for this field."
        if rice:
            answer = f"Rice scores {rice['score']} on {field.name}. {rice['why']}"
    elif "maize" in q:
        maize = next((c for c in ranked if c["name"].lower() == "maize"), None)
        answer = maize["why"] if maize else "Maize is scored from NASA field conditions."
        if maize:
            answer = f"Maize scores {maize['score']} on {field.name}. {maize['why']}"
    elif "rotation" in q or "soil builder" in q or "scenario" in q:
        first = (rots.get("scenarios") or [{}])[0]
        answer = first.get("why") or "Rotation scenarios use NASA field conditions plus your soil and crop history."
    elif "prioritize" in q or "priority" in q:
        answer = (
            "Move the Crop Analysis sliders and scores re-run against NASA POWER rainfall, "
            "temperature, soil wetness, and MODIS NDVI for the selected field."
        )
    elif top and ("suitable" in q or "best" in q or "recommend" in q):
        answer = (
            f"{top['name']} currently ranks highest for {field.name} (score {top['score']}). "
            f"{top['why']}"
        )
    elif low and ("lower" in q or "worst" in q or "ranked lower" in q):
        answer = (
            f"{low['name']} ranks lower for {field.name} (score {low['score']}) under current NASA conditions. "
            f"{low['why']}"
        )
    else:
        answer = (
            f"{field.name} ({field.area_ha:.1f} ha) in {_location(field)} has "
            f"{metrics['soil_moisture']} soil moisture, {metrics['rainfall']} rainfall, "
            f"{metrics['temperature']} mean temperature, and NDVI {metrics['ndvi']}. "
            + (f"Top crop match: {top['name']} ({top['score']})." if top else "")
        )
    return {
        "field_name": field.name,
        "field_id": field.id,
        "question": question,
        "answer": answer,
        "sources": sources,
    }
