import os
import io
import zipfile
from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.dependencies import get_db
from backend.middleware.auth import require_role
from backend.models.agent import Agent
from backend.models.agent import EnrollmentToken
from backend.schemas.agent import (
    AgentEnrollRequest,
    AgentEnrollResponse,
    AgentHeartbeat,
    AgentResponse,
    EnrollmentTokenCreate,
    EnrollmentTokenResponse,
)
from backend.schemas.event import EventCreate, EventResponse
from backend.schemas.endpoint_action import EndpointActionCommand, EndpointActionResponse, EndpointActionUpdate
from backend.services.agent_service import (
    agent_status,
    create_enrollment_token,
    enroll_agent,
    get_agent_by_api_key,
    normalize_ip,
)
from backend.services.event_ingestion_service import ingest_event
from backend.services.endpoint_action_service import (
    EndpointActionError,
    create_reconnect_token,
    get_queued_endpoint_actions,
    update_endpoint_action,
)


router = APIRouter(prefix="/agents", tags=["Agents"])
agent_bearer = HTTPBearer()


@router.get("/installers/{os_type}", include_in_schema=False)
def download_agent_bundle(os_type: str):
    if os_type not in {"windows", "linux"}:
        raise HTTPException(status_code=404, detail="Unsupported agent operating system")
    root = Path(__file__).resolve().parents[2]
    package_dirs = (
        "dejen_agent",
        "agent",
        "collectors/agent",
        "collectors/common",
        "collectors/fim",
    )
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for package_dir in package_dirs:
            for source in (root / package_dir).rglob("*.py"):
                if "__pycache__" not in source.parts:
                    bundle.write(source, source.relative_to(root))
        for source in (
            root / "packaging/dejen-agent.service",
            root / "packaging/register_dejen_agent.ps1",
            root / "packaging/com.dejen.agent.plist",
        ):
            bundle.write(source, source.relative_to(root))
        branding_dir = root / "Frontend/src/assets/images"
        for image_name in (
            "DEJEN SOC Ethiopian Cyber Shield1.png",
            "DEJEN SOC Ethiopian Cyber Shield2.png",
        ):
            image_path = branding_dir / image_name
            if image_path.is_file():
                bundle.write(image_path, f"dejen_agent/assets/{image_name}")
    archive.seek(0)
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="dejen-agent-{os_type}.zip"'},
    )


def require_agent(
    credentials: HTTPAuthorizationCredentials = Depends(agent_bearer),
    db: Session = Depends(get_db),
) -> Agent:
    agent = get_agent_by_api_key(db, credentials.credentials)
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked agent API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return agent


@router.post("/tokens", response_model=EnrollmentTokenResponse)
def issue_enrollment_token(
    payload: EnrollmentTokenCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("ADMIN")),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Agent name cannot be blank")
    token, expires_at = create_enrollment_token(
        db,
        name=name,
        os_type=payload.os,
        expires_in_minutes=payload.expires_in_minutes,
    )
    return {"token": token, "agent_name": name, "os": payload.os, "expires_at": expires_at}


@router.post("/enroll", response_model=AgentEnrollResponse, status_code=201)
def enroll(
    payload: AgentEnrollRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    result = enroll_agent(
        db,
        token=payload.token,
        version=payload.version,
        host=payload.host,
        ip=normalize_ip(str(payload.ip_address)) if payload.ip_address else normalize_ip(request.client.host if request.client else None),
        os_type=payload.os,
    )
    if result is None:
        raise HTTPException(status_code=401, detail="Enrollment token is invalid, expired, or already used")
    agent, api_key = result
    return {"agent_id": agent.id, "api_key": api_key, "name": agent.name}


@router.post("/heartbeat", status_code=204)
def heartbeat(
    payload: AgentHeartbeat,
    request: Request,
    agent: Agent = Depends(require_agent),
    db: Session = Depends(get_db),
):
    agent.last_seen = datetime.utcnow()
    agent.version = payload.version
    if payload.host:
        agent.host = payload.host
    agent.ip_address = normalize_ip(str(payload.ip_address)) if payload.ip_address else normalize_ip(request.client.host if request.client else None)
    db.commit()
    return Response(status_code=204)


@router.post("/events", response_model=EventResponse, status_code=201)
def submit_agent_event(
    payload: EventCreate,
    agent: Agent = Depends(require_agent),
    db: Session = Depends(get_db),
):
    payload.agent_id = str(agent.id)
    event = ingest_event(db, payload)
    agent.last_seen = datetime.utcnow()
    db.commit()
    return event


@router.get("/actions", response_model=list[EndpointActionCommand])
def poll_agent_actions(
    agent: Agent = Depends(require_agent),
    db: Session = Depends(get_db),
):
    return get_queued_endpoint_actions(db, agent.id)


@router.patch("/actions/{action_id}", response_model=EndpointActionResponse)
def acknowledge_agent_action(
    action_id: UUID,
    payload: EndpointActionUpdate,
    agent: Agent = Depends(require_agent),
    db: Session = Depends(get_db),
):
    action = update_endpoint_action(
        db,
        action_id=action_id,
        agent_id=agent.id,
        status=payload.status,
        result=payload.result,
    )
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    return action


@router.post("/{agent_id}/reconnect-token", response_model=EnrollmentTokenResponse)
def issue_reconnect_token(
    agent_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("ADMIN")),
):
    try:
        agent, token, expires_at = create_reconnect_token(db, agent_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except EndpointActionError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {
        "token": token,
        "agent_name": agent.name,
        "os": agent.os_type,
        "expires_at": expires_at,
    }


@router.get("", response_model=list[AgentResponse])
def list_agents(
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("ADMIN", "ANALYST")),
):
    timeout = max(15, int(os.getenv("DEJEN_AGENT_TIMEOUT_SECONDS", "20")))
    now = datetime.utcnow()
    agents = db.scalars(select(Agent).order_by(Agent.created_at.desc())).all()
    return [
        {
            "id": agent.id,
            "name": agent.name,
            "os_type": agent.os_type,
            "host": agent.host,
            "ip_address": agent.ip_address,
            "status": agent_status(agent, now=now, timeout_seconds=timeout),
            "last_seen": agent.last_seen,
            "version": agent.version,
            "created_at": agent.created_at,
        }
        for agent in agents
    ]


@router.delete("/{agent_id}", status_code=204)
def remove_agent(
    agent_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("ADMIN")),
):
    agent = db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.query(EnrollmentToken).filter(EnrollmentToken.agent_id == agent_id).delete(
        synchronize_session=False
    )
    db.delete(agent)
    db.commit()
    return Response(status_code=204)