from uuid import uuid4

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from fastapi import HTTPException

from backend.database.base import Base
from backend.handlers.events import delete_all_events
from backend.models.endpoint_action import EndpointAction
from backend.models import (
    Agent,
    Alert,
    Event,
    Incident,
    IncidentAction,
    InvestigationNote,
    User,
)
from backend.schemas.event import EventDeleteRequest
from backend.services.auth_service import hash_password
from backend.services.event_service import delete_events


def make_database():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    return engine, Session(engine)


def add_event_chain(db):
    user = User(username=f"admin-{uuid4()}", password_hash="hash", role="ADMIN")
    agent = Agent(
        name=f"endpoint-{uuid4()}",
        os_type="linux",
        api_key_hash=str(uuid4()),
    )
    event = Event(
        agent_id=str(agent.id or uuid4()),
        host="endpoint",
        event_type="login_failure",
        message="test event",
        severity="HIGH",
    )
    db.add_all([user, agent, event])
    db.flush()
    event.agent_id = str(agent.id)
    alert = Alert(
        event_id=event.event_id,
        rule_name="test",
        title="Test alert",
        description="Test description",
        severity="HIGH",
        risk_score=80,
        status="OPEN",
    )
    db.add(alert)
    db.flush()
    incident = Incident(
        alert_id=alert.alert_id,
        title="Test incident",
        description="Test description",
        severity="HIGH",
        status="OPEN",
    )
    db.add(incident)
    db.flush()
    db.add_all([
        EndpointAction(
            alert_id=alert.alert_id,
            agent_id=agent.id,
            action_type="BLOCK_ENDPOINT_IP",
            status="PENDING",
            requested_by=user.username,
        ),
        IncidentAction(
            incident_id=incident.incident_id,
            user_id=user.id,
            action_type="CREATED",
            description="Incident created",
        ),
        InvestigationNote(
            incident_id=incident.incident_id,
            user_id=user.id,
            content="Investigation note",
        ),
    ])
    db.flush()
    return event


def count_rows(db, model):
    return db.scalar(select(func.count()).select_from(model))


def test_delete_event_removes_linked_alert_and_incident_records():
    engine, db = make_database()
    target_event = add_event_chain(db)
    remaining_event = Event(
        agent_id="other-agent",
        host="other-endpoint",
        event_type="authentication_success",
        message="keep this event",
        severity="LOW",
    )
    db.add(remaining_event)
    db.commit()

    assert delete_events(db, target_event.event_id) == 1
    assert count_rows(db, Event) == 1
    assert count_rows(db, Alert) == 0
    assert count_rows(db, Incident) == 0
    assert count_rows(db, EndpointAction) == 0
    assert count_rows(db, IncidentAction) == 0
    assert count_rows(db, InvestigationNote) == 0
    db.close()
    engine.dispose()


def test_delete_all_events_removes_all_linked_records():
    engine, db = make_database()
    add_event_chain(db)
    add_event_chain(db)
    db.commit()

    assert delete_events(db) == 2
    assert count_rows(db, Event) == 0
    assert count_rows(db, Alert) == 0
    assert count_rows(db, Incident) == 0
    assert count_rows(db, EndpointAction) == 0
    assert count_rows(db, IncidentAction) == 0
    assert count_rows(db, InvestigationNote) == 0
    db.close()
    engine.dispose()


def test_bulk_delete_requires_correct_active_admin_password():
    engine, db = make_database()
    event = add_event_chain(db)
    user = db.scalar(select(User).where(User.role == "ADMIN"))
    user.password_hash = hash_password("admin-secret")
    db.commit()
    current_user = {"sub": str(user.id), "role": "ADMIN"}

    try:
        delete_all_events(EventDeleteRequest(password="incorrect"), db, current_user)
    except HTTPException as error:
        assert error.status_code == 403
    else:
        raise AssertionError("Incorrect administrator password was accepted")
    assert db.get(Event, event.event_id) is not None

    result = delete_all_events(EventDeleteRequest(password="admin-secret"), db, current_user)
    assert result == {"deleted_events": 1}
    assert count_rows(db, Event) == 0
    db.close()
    engine.dispose()