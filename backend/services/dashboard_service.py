import os
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.agent import Agent
from backend.models.alert import Alert
from backend.models.event import Event
from backend.models.incident import Incident


def get_dashboard_summary(db: Session) -> dict:
    agent_timeout_seconds = max(15, int(os.getenv("DEJEN_AGENT_TIMEOUT_SECONDS", "20")))
    active_since = datetime.utcnow() - timedelta(seconds=agent_timeout_seconds)
    total_endpoints = db.scalar(select(func.count()).select_from(Agent)) or 0
    active_endpoints = db.scalar(
        select(func.count()).select_from(Agent).where(Agent.last_seen >= active_since)
    ) or 0

    total_events = db.scalar(
        select(func.count()).select_from(Event)
    ) or 0

    total_alerts = db.scalar(
        select(func.count()).select_from(Alert)
    ) or 0

    open_alerts = db.scalar(
        select(func.count()).select_from(Alert).where(
            Alert.status == "OPEN"
        )
    ) or 0

    critical_alerts = db.scalar(
        select(func.count()).select_from(Alert).where(
            Alert.severity == "CRITICAL"
        )
    ) or 0

    total_incidents = db.scalar(
        select(func.count()).select_from(Incident)
    ) or 0

    open_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.status == "OPEN"
        )
    ) or 0

    investigating_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.status == "INVESTIGATING"
        )
    ) or 0

    resolved_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.status == "RESOLVED"
        )
    ) or 0

    return {
        "total_events": total_events,
        "total_alerts": total_alerts,
        "open_alerts": open_alerts,
        "critical_alerts": critical_alerts,
        "total_incidents": total_incidents,
        "open_incidents": open_incidents,
        "investigating_incidents": investigating_incidents,
        "resolved_incidents": resolved_incidents,
        "total_endpoints": total_endpoints,
        "active_endpoints": active_endpoints,
    }
