from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.alert import Alert
from backend.models.incident import Incident


AUTO_INCIDENT_SEVERITIES = {
    "HIGH",
    "CRITICAL",
}


def create_incident_from_alert(
    db: Session,
    alert: Alert,
) -> Incident | None:
    """
    Automatically create an incident for a HIGH or CRITICAL alert.

    Returns the existing incident if one already exists.
    Returns None when the alert severity does not require an incident.
    """

    if alert.severity not in AUTO_INCIDENT_SEVERITIES:
        return None

    existing_incident = db.scalar(
        select(Incident).where(
            Incident.alert_id == alert.alert_id
        )
    )

    if existing_incident:
        return existing_incident

    incident = Incident(
        alert_id=alert.alert_id,
        title=alert.title,
        description=alert.description,
        severity=alert.severity,
        status="OPEN",
        assigned_to=None,
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)

    return incident
