from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.services.personal_assistant_service import ask_personal_assistant

router = APIRouter(prefix="/api", tags=["assistant"])
bearer = HTTPBearer()


class ChatTurn(BaseModel):
    q: str = Field(max_length=1000)
    a: str = Field(max_length=2000)


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    field_id: str | None = None
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


@router.post("/assistant")
def ask_assistant(
    body: AssistantRequest,
    user=Depends(get_current_user),
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)] = None,
):
    # get_current_user must validate the JWT; never accept user_id from the client.
    user_id = user["id"] if isinstance(user, dict) else user.id
    return ask_personal_assistant(
        question=body.question,
        field_id=body.field_id,
        token=credentials.credentials,
        user_id=str(user_id),
        history=[turn.model_dump() for turn in body.history],
    )
