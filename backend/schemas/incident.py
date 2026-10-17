from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IncidentCreate(BaseModel):
    alert_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    severity: str = Field(min_length=1, max_length=20)
    assigned_to: str | None = Field(
        default=None,
        max_length=100,
    )


class IncidentResponse(BaseModel):
    incident_id: UUID
    alert_id: UUID
    title: str
    description: str
    severity: str
    status: str
    assigned_to: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentStatusUpdate(BaseModel):
    status: str = Field(
        min_length=1,
        max_length=20,
    )


class IncidentAssignmentUpdate(BaseModel):
    assigned_to: str | None = Field(
        default=None,
        max_length=100,
    )
