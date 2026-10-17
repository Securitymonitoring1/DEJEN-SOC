from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.incident import Incident
from backend.schemas.incident import IncidentCreate


def create_incident(
    db: Session,
    incident_data: IncidentCreate,
) -> Incident:
    incident = Incident(
        alert_id=incident_data.alert_id,
        title=incident_data.title,
        description=incident_data.description,
        severity=incident_data.severity,
        assigned_to=incident_data.assigned_to,
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)

    return incident


def get_incidents(db: Session) -> list[Incident]:
    statement = select(Incident).order_by(
        Incident.created_at.desc()
    )

    return list(db.scalars(statement).all())


def get_incident(
    db: Session,
    incident_id: UUID,
) -> Incident | None:
    statement = select(Incident).where(
        Incident.incident_id == incident_id
    )

    return db.scalar(statement)


def update_incident_status(
    db: Session,
    incident_id: UUID,
    status: str,
) -> Incident | None:
    incident = get_incident(db, incident_id)

    if incident is None:
        return None

    incident.status = status

    db.commit()
    db.refresh(incident)

    return incident


def update_incident_assignment(
    db: Session,
    incident_id: UUID,
    assigned_to: str | None,
) -> Incident | None:
    incident = get_incident(db, incident_id)

    if incident is None:
        return None

    incident.assigned_to = assigned_to

    db.commit()
    db.refresh(incident)

    return incident
