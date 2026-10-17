from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress


Severity = Literal[
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
]


class EventCreate(BaseModel):
    timestamp: datetime | None = None
    agent_id: str = Field(
        min_length=1,
        max_length=100,
    )
    host: str = Field(
        min_length=1,
        max_length=255,
    )
    event_type: str = Field(
        min_length=1,
        max_length=100,
    )
    username: str | None = Field(
        default=None,
        max_length=100,
    )
    source_ip: IPvAnyAddress | None = None
    dest_port: int | None = Field(default=None, ge=1, le=65535)
    message: str = Field(
        min_length=1,
        max_length=5000,
    )
    severity: Severity = "LOW"


class EventResponse(BaseModel):
    event_id: UUID
    timestamp: datetime
    agent_id: str
    host: str
    event_type: str
    username: str | None
    source_ip: str | None
    message: str
    severity: str

    model_config = ConfigDict(from_attributes=True)
