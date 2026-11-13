"""Supabase authentication for protected FastAPI endpoints."""

from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from app import config


security = HTTPBearer(auto_error=False)


def get_supabase_client() -> Client:
    """Create a Supabase client using the publishable key."""

    if not config.SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not configured")

    if not config.SUPABASE_PUBLISHABLE_KEY:
        raise RuntimeError(
            "SUPABASE_PUBLISHABLE_KEY is not configured"
        )

    return create_client(
        config.SUPABASE_URL,
        config.SUPABASE_PUBLISHABLE_KEY,
    )


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ],
):
    """Validate the bearer token and return the authenticated user."""

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        supabase = get_supabase_client()

        response = supabase.auth.get_user(token)

        if response.user is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token",
            )

        return response.user

    except HTTPException:
        raise

    except Exception as e:
        # Temporary debugging: never print access tokens or API keys.

        print(
            "SUPABASE AUTH DEBUG:",
            type(e).__name__,
        )

        print(
            "SUPABASE STATUS:",
            getattr(e, "status", "Unknown"),
        )

        print(
            "SUPABASE ERROR CODE:",
            getattr(e, "code", "Unknown"),
        )

        print(
            "SUPABASE ERROR MESSAGE:",
            getattr(e, "message", "Unknown"),
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )