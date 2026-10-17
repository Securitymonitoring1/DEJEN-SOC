from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InvestigationNoteCreate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=5000,
    )


class InvestigationNoteResponse(BaseModel):
    note_id: UUID
    incident_id: UUID
    user_id: int
    username: str
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
