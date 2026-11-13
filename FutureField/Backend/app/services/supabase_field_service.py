"""
FutureField — Supabase Field Storage

Stores personal farm fields in Supabase PostgreSQL.

Security:
- Uses the authenticated user's JWT.
- Uses Supabase Row Level Security.
- Never uses a service-role key.
- Never trusts user_id from the frontend.
"""

import uuid
from datetime import datetime, timezone

import httpx

from fastapi import HTTPException

from app import config
from app.knowledge.loader import load_regions
from app.schemas.field import FieldCreate, FieldOut
from app.utils import geo


# --------------------------------------------------
# Supabase Configuration
# --------------------------------------------------

SUPABASE_URL = config.SUPABASE_URL.rstrip("/")

SUPABASE_KEY = config.SUPABASE_PUBLISHABLE_KEY

FIELDS_URL = f"{SUPABASE_URL}/rest/v1/fields"


# --------------------------------------------------
# Authentication Headers
# --------------------------------------------------

def _headers(token: str) -> dict:

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# --------------------------------------------------
# Supabase Error Handling
# --------------------------------------------------

def _check_response(response: httpx.Response):

    if response.status_code >= 400:

        print("\n========== SUPABASE DATABASE ERROR ==========")
        print("Status:", response.status_code)
        print("Response:", response.text)
        print("=============================================\n")

        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=403,
                detail="Access denied"
            )

        raise HTTPException(
            status_code=502,
            detail="Field database request failed"
        )

    return response.json() if response.content else None


# --------------------------------------------------
# Build Field Data
# --------------------------------------------------

def _build_field_data(
    payload: FieldCreate,
    field_id: str,
    user_id: str,
    created_at: str | None = None
) -> dict:

    geo.validate_polygon(
        payload.boundary,
        load_regions()["supported_bbox"]
    )

    lat, lon = geo.centroid(payload.boundary)

    area = round(
        geo.area_ha(payload.boundary),
        3
    )

    data = payload.model_dump(mode="json")

    data.update({
        "id": field_id,
        "user_id": user_id,
        "centroid_lat": lat,
        "centroid_lon": lon,
        "area_ha": area,
    })

    if created_at:
        data["created_at"] = created_at

    return data


# --------------------------------------------------
# Create Field
# --------------------------------------------------

def create_field(
    payload: FieldCreate,
    token: str,
    user_id: str
) -> FieldOut:

    field_id = str(uuid.uuid4())

    data = _build_field_data(
        payload,
        field_id,
        user_id
    )

    headers = _headers(token)

    headers["Prefer"] = "return=representation"

    with httpx.Client(timeout=30.0) as client:

        response = client.post(
            FIELDS_URL,
            headers=headers,
            json=data
        )

    rows = _check_response(response)

    if not rows:
        raise HTTPException(
            status_code=502,
            detail="Field creation returned no data"
        )

    return FieldOut(**rows[0])


# --------------------------------------------------
# List User Fields
# --------------------------------------------------

def list_fields(
    token: str,
    user_id: str
) -> list[FieldOut]:

    with httpx.Client(timeout=30.0) as client:

        response = client.get(
            FIELDS_URL,
            headers=_headers(token),
            params={
                "select": "*",
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
            }
        )

    rows = _check_response(response)

    return [
        FieldOut(**row)
        for row in (rows or [])
    ]


# --------------------------------------------------
# Get One Field
# --------------------------------------------------

def get_field(
    field_id: str,
    token: str,
    user_id: str
) -> FieldOut:

    with httpx.Client(timeout=30.0) as client:

        response = client.get(
            FIELDS_URL,
            headers=_headers(token),
            params={
                "select": "*",
                "id": f"eq.{field_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            }
        )

    rows = _check_response(response)

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Field not found"
        )

    return FieldOut(**rows[0])


# --------------------------------------------------
# Update Field
# --------------------------------------------------

def update_field(
    field_id: str,
    payload: FieldCreate,
    token: str,
    user_id: str
) -> FieldOut:

    old = get_field(
        field_id,
        token,
        user_id
    )

    data = _build_field_data(
        payload,
        field_id,
        user_id,
        old.created_at.isoformat()
    )

    # Only update editable and calculated field data.
    # Ownership and creation timestamp remain unchanged.
    data.pop("id", None)
    data.pop("user_id", None)
    data.pop("created_at", None)

    data["updated_at"] = datetime.now(
        timezone.utc
    ).isoformat()

    headers = _headers(token)

    headers["Prefer"] = "return=representation"

    with httpx.Client(timeout=30.0) as client:

        response = client.patch(
            FIELDS_URL,
            headers=headers,
            params={
                "id": f"eq.{field_id}",
                "user_id": f"eq.{user_id}",
            },
            json=data
        )

    rows = _check_response(response)

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Field not found"
        )

    return FieldOut(**rows[0])


# --------------------------------------------------
# Delete Field
# --------------------------------------------------

def delete_field(
    field_id: str,
    token: str,
    user_id: str
) -> None:

    # Confirm ownership before deletion.
    get_field(
        field_id,
        token,
        user_id
    )

    with httpx.Client(timeout=30.0) as client:

        response = client.delete(
            FIELDS_URL,
            headers=_headers(token),
            params={
                "id": f"eq.{field_id}",
                "user_id": f"eq.{user_id}",
            }
        )

    _check_response(response)