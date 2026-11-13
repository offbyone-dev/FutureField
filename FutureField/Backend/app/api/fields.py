from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user, security
from app.schemas.field import FieldCreate, FieldOut
from app.services import supabase_field_service

router = APIRouter(tags=["fields"])


def get_auth_context(
    user=Depends(get_current_user),
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ] = None,
):
    return {
        "user_id": str(user.id),
        "token": credentials.credentials,
    }


@router.post("/fields", response_model=FieldOut, status_code=201)
def create_field(
    body: FieldCreate,
    auth=Depends(get_auth_context),
):
    return supabase_field_service.create_field(
        body,
        auth["token"],
        auth["user_id"],
    )


@router.get("/fields", response_model=list[FieldOut])
def list_fields(auth=Depends(get_auth_context)):
    return supabase_field_service.list_fields(
        auth["token"],
        auth["user_id"],
    )


@router.get("/fields/{field_id}", response_model=FieldOut)
def get_field(
    field_id: str,
    auth=Depends(get_auth_context),
):
    return supabase_field_service.get_field(
        field_id,
        auth["token"],
        auth["user_id"],
    )


@router.patch("/fields/{field_id}", response_model=FieldOut)
@router.put("/fields/{field_id}", response_model=FieldOut)
def update_field(
    field_id: str,
    body: FieldCreate,
    auth=Depends(get_auth_context),
):
    return supabase_field_service.update_field(
        field_id,
        body,
        auth["token"],
        auth["user_id"],
    )


@router.delete("/fields/{field_id}", status_code=204)
def delete_field(
    field_id: str,
    auth=Depends(get_auth_context),
):
    supabase_field_service.delete_field(
        field_id,
        auth["token"],
        auth["user_id"],
    )