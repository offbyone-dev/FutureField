from fastapi import APIRouter, Query

from app.services import ui_service

router = APIRouter(prefix="/api", tags=["data-explorer"])


@router.get("/data-explorer")
def get_data_explorer(field_id: str | None = Query(default=None), dataset: str | None = Query(default=None)):
    return ui_service.data_explorer(field_id, dataset)


@router.get("/data-explorer/time-series/{dataset_name}")
def get_time_series(dataset_name: str, field_id: str | None = Query(default=None)):
    return ui_service.data_explorer(field_id, dataset_name)
