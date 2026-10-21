import os
import secrets
from datetime import datetime, timedelta
from ipaddress import ip_address
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.agent import Agent, EnrollmentToken
from backend.models.alert import Alert
from backend.models.endpoint_action import EndpointAction
from backend.models.event import Event
from backend.services.agent_service import hash_secret


def create_reconnect_token(db: Session, agent_id: UUID) -> tuple[Agent, str, datetime]:
    agent = db.get(Agent, agent_id)
    if agent is None:
        raise LookupError("Endpoint not found")
    timeout_seconds = max(15, int(os.getenv("DEJEN_AGENT_TIMEOUT_SECONDS", "20")))
    if (
        agent.last_seen is not None
        and (datetime.utcnow() - agent.last_seen).total_seconds() <= timeout_seconds
    ):
        raise EndpointActionError("Endpoint is still connected")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    db.add(
        EnrollmentToken(
            token_hash=hash_secret(token),
            agent_id=agent.id,
            agent_name=agent.name,
            os_type=agent.os_type,
            expires_at=expires_at,
        )
    )
    db.commit()
    return agent, token, expires_at


class EndpointActionError(ValueError):
    pass


def create_endpoint_actions(
    db: Session,
    *,
    alert_id: UUID,
    action_type: str,
    requested_by: str,
) -> list[EndpointAction]:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise LookupError("Alert not found")
    event = db.get(Event, alert.event_id)
    if event is None:
        raise EndpointActionError("The alert has no source event")

    target_ip = None
    try:
        agent_id = UUID(event.agent_id)
    except (ValueError, TypeError, AttributeError) as error:
        raise EndpointActionError("The alert event is not associated with an enrolled endpoint") from error
    agent = db.get(Agent, agent_id)
    if agent is None or agent.last_seen is None:
        raise EndpointActionError("The alert endpoint is not enrolled or has never checked in")
    agents = [agent]

    if action_type in {"BLOCK_ENDPOINT_IP", "UNBLOCK_ENDPOINT_IP"}:
        if not agent.ip_address:
            raise EndpointActionError("The endpoint has no recorded IP address to block")
        try:
            target_ip = str(ip_address(agent.ip_address))
        except ValueError as error:
            raise EndpointActionError("The endpoint IP address is invalid") from error

    actions = [
        EndpointAction(
            alert_id=alert.alert_id,
            agent_id=agent.id,
            action_type=action_type,
            target_ip=target_ip,
            requested_by=requested_by,
        )
        for agent in agents
    ]
    db.add_all(actions)
    db.commit()
    for action in actions:
        db.refresh(action)
    return actions


def get_queued_endpoint_actions(db: Session, agent_id: UUID) -> list[EndpointAction]:
    return list(
        db.scalars(
            select(EndpointAction)
            .where(
                EndpointAction.agent_id == agent_id,
                EndpointAction.status.in_(("PENDING", "RUNNING")),
            )
            .order_by(EndpointAction.created_at, EndpointAction.action_id)
        ).all()
    )


def get_alert_endpoint_actions(db: Session, alert_id: UUID) -> list[EndpointAction]:
    return list(
        db.scalars(
            select(EndpointAction)
            .where(EndpointAction.alert_id == alert_id)
            .order_by(EndpointAction.created_at.desc(), EndpointAction.action_id)
        ).all()
    )


def update_endpoint_action(
    db: Session,
    *,
    action_id: UUID,
    agent_id: UUID,
    status: str,
    result: str | None,
) -> EndpointAction | None:
    action = db.get(EndpointAction, action_id)
    if action is None or action.agent_id != agent_id:
        return None

    allowed_next = {
        "PENDING": {"RUNNING"},
        "RUNNING": {"RUNNING", "SUCCEEDED", "FAILED"},
    }
    if status not in allowed_next.get(action.status, set()):
        return action

    action.status = status
    if result is not None:
        action.result = result[:2000]
    if action.action_type == "DISCONNECT_AGENT" and status == "SUCCEEDED":
        agent = db.get(Agent, agent_id)
        if agent is not None:
            timeout_seconds = max(15, int(os.getenv("DEJEN_AGENT_TIMEOUT_SECONDS", "20")))
            agent.api_key_hash = hash_secret(secrets.token_urlsafe(48))
            agent.last_seen = datetime.utcnow() - timedelta(seconds=timeout_seconds + 1)
    db.commit()
    db.refresh(action)
    return action