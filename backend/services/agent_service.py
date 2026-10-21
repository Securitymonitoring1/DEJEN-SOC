import hashlib
import secrets
from datetime import datetime, timedelta
from ipaddress import ip_address

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.agent import Agent, EnrollmentToken

SUPPORTED_AGENT_OS = {"windows", "linux"}


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def validate_agent_os(os_type: str | None) -> str | None:
    if os_type is None:
        return None
    if os_type not in SUPPORTED_AGENT_OS:
        raise ValueError(f"Unsupported agent operating system: {os_type}")
    return os_type


def create_enrollment_token(
    db: Session, *, name: str, os_type: str, expires_in_minutes: int
) -> tuple[str, datetime]:
    os_type = validate_agent_os(os_type)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
    agent = Agent(
        name=name,
        os_type=os_type,
        api_key_hash=hash_secret(secrets.token_urlsafe(48)),
    )
    db.add(agent)
    db.flush()
    db.add(
        EnrollmentToken(
            token_hash=hash_secret(token),
            agent_id=agent.id,
            agent_name=name,
            os_type=os_type,
            expires_at=expires_at,
        )
    )
    db.commit()
    return token, expires_at


def enroll_agent(
    db: Session,
    *,
    token: str,
    version: str,
    host: str | None,
    ip: str | None,
    os_type: str | None = None,
) -> tuple[Agent, str] | None:
    os_type = validate_agent_os(os_type)
    enrollment = db.scalar(
        select(EnrollmentToken)
        .where(EnrollmentToken.token_hash == hash_secret(token))
        .with_for_update()
    )
    now = datetime.utcnow()
    if (
        enrollment is None
        or enrollment.used_at is not None
        or enrollment.expires_at <= now
        or (os_type is not None and enrollment.os_type != os_type)
    ):
        return None

    agent = db.get(Agent, enrollment.agent_id)
    if agent is None:
        return None
    api_key = secrets.token_urlsafe(48)
    agent.api_key_hash = hash_secret(api_key)
    agent.host = host
    agent.ip_address = ip
    agent.version = version
    agent.last_seen = None
    enrollment.used_at = now
    db.commit()
    db.refresh(agent)
    return agent, api_key


def get_agent_by_api_key(db: Session, api_key: str) -> Agent | None:
    return db.scalar(
        select(Agent).where(Agent.api_key_hash == hash_secret(api_key))
    )


def normalize_ip(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(ip_address(value))
    except ValueError:
        return None


def agent_status(agent: Agent, *, now: datetime, timeout_seconds: int) -> str:
    if agent.last_seen is None:
        return "Never connected"
    if (now - agent.last_seen).total_seconds() > timeout_seconds:
        return "Disconnected"
    return "Active"