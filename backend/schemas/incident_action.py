from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class IncidentActionResponse(BaseModel):
    action_id: UUID
    incident_id: UUID
    user_id: int
    username: str
    role: str
    action_type: str
    description: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
