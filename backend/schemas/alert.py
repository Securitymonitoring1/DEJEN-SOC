from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AlertResponse(BaseModel):
    alert_id: UUID
    created_at: datetime
    event_id: UUID
    rule_name: str
    title: str
    description: str
    severity: str
    risk_score: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class AlertCreate(BaseModel):
    event_id: UUID
    rule_name: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    severity: str = Field(min_length=1, max_length=20)
    risk_score: int = Field(ge=0, le=100)


class AlertStatusUpdate(BaseModel):
    status: str = Field(
        min_length=1,
        max_length=20,
    )
