from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.models.alert import Alert
from backend.models.endpoint_action import EndpointAction
from backend.models.event import Event
from backend.models.incident import Incident
from backend.models.incident_action import IncidentAction
from backend.models.investigation_note import InvestigationNote
from backend.schemas.event import EventCreate


def create_event(db: Session, event_data: EventCreate) -> Event:
    timestamp = event_data.timestamp
    if timestamp is not None and timestamp.tzinfo is not None:
        timestamp = timestamp.astimezone(timezone.utc).replace(tzinfo=None)
    event = Event(
        timestamp=timestamp or datetime.utcnow(),
        agent_id=event_data.agent_id,
        host=event_data.host,
        event_type=event_data.event_type,
        username=event_data.username,
        source_ip=str(event_data.source_ip) if event_data.source_ip else None,
        message=event_data.message,
        severity=event_data.severity,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


def get_events(db: Session) -> list[Event]:
    statement = select(Event).order_by(Event.timestamp.desc())
    return list(db.scalars(statement).all())


def get_event(db: Session, event_id):
    statement = select(Event).where(Event.event_id == event_id)
    return db.scalar(statement)


def delete_events(db: Session, event_id=None) -> int:
    event_query = select(Event.event_id)
    if event_id is not None:
        event_query = event_query.where(Event.event_id == event_id)
    event_ids = list(db.scalars(event_query).all())
    if not event_ids:
        return 0

    alert_ids = list(db.scalars(
        select(Alert.alert_id).where(Alert.event_id.in_(event_ids))
    ).all())
    if alert_ids:
        incident_ids = list(db.scalars(
            select(Incident.incident_id).where(Incident.alert_id.in_(alert_ids))
        ).all())
        if incident_ids:
            db.execute(delete(InvestigationNote).where(
                InvestigationNote.incident_id.in_(incident_ids)
            ))
            db.execute(delete(IncidentAction).where(
                IncidentAction.incident_id.in_(incident_ids)
            ))
            db.execute(delete(Incident).where(Incident.incident_id.in_(incident_ids)))
        db.execute(delete(EndpointAction).where(EndpointAction.alert_id.in_(alert_ids)))
        db.execute(delete(Alert).where(Alert.alert_id.in_(alert_ids)))

    db.execute(delete(Event).where(Event.event_id.in_(event_ids)))
    db.commit()
    return len(event_ids)
