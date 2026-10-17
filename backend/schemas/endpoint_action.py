from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


ActionType = Literal[
    "BLOCK_ENDPOINT_IP",
    "UNBLOCK_ENDPOINT_IP",
    "ISOLATE_ENDPOINT",
    "UNISOLATE_ENDPOINT",
    "DISCONNECT_AGENT",
]
ActionStatus = Literal["PENDING", "RUNNING", "SUCCEEDED", "FAILED"]


class EndpointActionCreate(BaseModel):
    action_type: ActionType


class EndpointActionUpdate(BaseModel):
    status: Literal["RUNNING", "SUCCEEDED", "FAILED"]
    result: str | None = None


class EndpointActionResponse(BaseModel):
    action_id: UUID
    alert_id: UUID
    agent_id: UUID
    action_type: ActionType
    target_ip: str | None
    status: ActionStatus
    requested_by: str
    result: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EndpointActionCommand(BaseModel):
    action_id: UUID
    action_type: ActionType
    target_ip: str | None