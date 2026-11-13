"""Authenticated personal field-condition endpoint."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials
from app.auth import get_current_user, security
from app.services import personal_field_condition_service

router = APIRouter(tags=["personal-field-condition"])

@router.get("/personal/fields/{field_id}/condition")
def get_personal_condition(
    field_id: str,
    refresh: bool = Query(default=False),
    user=Depends(get_current_user),
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None,
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return personal_field_condition_service.get_personal_field_condition(
        field_id=field_id, token=credentials.credentials,
        user_id=str(user.id), refresh=refresh,
    )
