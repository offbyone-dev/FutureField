from fastapi import APIRouter, HTTPException, Query

from app.services import ui_service

router = APIRouter(prefix="/api", tags=["climate-insights"])


@router.get("/climate-insights")
def get_climate_insights(field_id: str | None = Query(default=None)):
    return ui_service.climate_insights(field_id)


@router.get("/climate-insights/source/{source_name}")
def get_source_detail(source_name: str, field_id: str | None = Query(default=None)):
    data = ui_service.climate_insights(field_id)
    info = data.get("source_details", {}).get(source_name)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Source '{source_name}' not found.")
    return {"source": source_name, **info}
