from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress


AgentOS = Literal["windows", "linux"]


class EnrollmentTokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    os: AgentOS
    expires_in_minutes: int = Field(default=15, ge=1, le=1440)


class EnrollmentTokenResponse(BaseModel):
    token: str
    agent_name: str
    os: AgentOS
    expires_at: datetime


class AgentEnrollRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    os: AgentOS | None = None
    version: str = Field(default="1.0.0", max_length=50)
    host: str | None = Field(default=None, max_length=255)
    ip_address: IPvAnyAddress | None = None


class AgentEnrollResponse(BaseModel):
    agent_id: UUID
    api_key: str
    name: str


class AgentHeartbeat(BaseModel):
    version: str = Field(default="1.0.0", max_length=50)
    host: str | None = Field(default=None, max_length=255)
    ip_address: IPvAnyAddress | None = None


class AgentResponse(BaseModel):
    id: UUID
    name: str
    os_type: AgentOS
    host: str | None
    ip_address: str | None
    status: Literal["Active", "Disconnected", "Never connected"]
    last_seen: datetime | None
    version: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)