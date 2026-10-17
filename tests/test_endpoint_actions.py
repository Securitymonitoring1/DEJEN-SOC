from datetime import datetime
from uuid import uuid4

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.database.base import Base
from backend.models.agent import Agent
from backend.models.alert import Alert
from backend.models.endpoint_action import EndpointAction
from backend.models.event import Event
from backend.services.endpoint_action_service import (
    EndpointActionError,
    create_endpoint_actions,
    create_reconnect_token,
    get_queued_endpoint_actions,
    update_endpoint_action,
)
from backend.services.agent_service import (
    agent_status,
    enroll_agent,
    get_agent_by_api_key,
    hash_secret,
)


def make_database():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    return engine, Session(engine)


def add_agent(db, *, name, last_seen, ip_address="192.0.2.10"):
    agent = Agent(
        name=name,
        os_type="windows",
        api_key_hash=f"hash-{uuid4()}",
        host=name,
        ip_address=ip_address,
        last_seen=last_seen,
    )
    db.add(agent)
    db.flush()
    return agent


def add_alert(db, *, agent_id, source_ip="192.0.2.90"):
    event = Event(
        agent_id=str(agent_id),
        host="endpoint",
        event_type="connection_attempt",
        source_ip=source_ip,
        message="test event",
        severity="HIGH",
    )
    db.add(event)
    db.flush()
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
    db.commit()
    return alert


def test_block_endpoint_ip_targets_only_alert_endpoint_not_alert_source_ip():
    engine, db = make_database()
    now = datetime.utcnow()
    first = add_agent(db, name="one", last_seen=now)
    second = add_agent(db, name="two", last_seen=now)
    add_agent(db, name="never-connected", last_seen=None)
    alert = add_alert(db, agent_id=first.id)

    actions = create_endpoint_actions(
        db,
        alert_id=alert.alert_id,
        action_type="BLOCK_ENDPOINT_IP",
        requested_by="analyst",
    )

    assert len(actions) == 1
    assert actions[0].agent_id == first.id
    assert actions[0].target_ip == first.ip_address
    assert actions[0].target_ip != "192.0.2.90"
    assert actions[0].agent_id != second.id
    engine.dispose()


def test_isolate_targets_alert_endpoint_and_ack_is_agent_scoped():
    engine, db = make_database()
    agent = add_agent(db, name="alert-endpoint", last_seen=datetime.utcnow())
    other = add_agent(db, name="other-endpoint", last_seen=datetime.utcnow())
    alert = add_alert(db, agent_id=agent.id)

    action = create_endpoint_actions(
        db,
        alert_id=alert.alert_id,
        action_type="ISOLATE_ENDPOINT",
        requested_by="admin",
    )[0]

    assert action.agent_id == agent.id
    assert [item.action_id for item in get_queued_endpoint_actions(db, agent.id)] == [action.action_id]
    assert update_endpoint_action(
        db,
        action_id=action.action_id,
        agent_id=other.id,
        status="RUNNING",
        result=None,
    ) is None
    assert update_endpoint_action(
        db,
        action_id=action.action_id,
        agent_id=agent.id,
        status="RUNNING",
        result="started",
    ).status == "RUNNING"
    completed = update_endpoint_action(
        db,
        action_id=action.action_id,
        agent_id=agent.id,
        status="SUCCEEDED",
        result="adapter disabled",
    )
    assert completed.status == "SUCCEEDED"
    assert get_queued_endpoint_actions(db, agent.id) == []
    engine.dispose()


def test_block_requires_endpoint_ip():
    engine, db = make_database()
    agent = add_agent(db, name="endpoint", last_seen=datetime.utcnow(), ip_address=None)
    alert = add_alert(db, agent_id=agent.id, source_ip="192.0.2.90")

    try:
        create_endpoint_actions(
            db,
            alert_id=alert.alert_id,
            action_type="BLOCK_ENDPOINT_IP",
            requested_by="analyst",
        )
    except EndpointActionError as error:
        assert "no recorded IP" in str(error)
    else:
        raise AssertionError("blocking without a source IP should be rejected")
    assert db.scalars(select(EndpointAction)).all() == []
    engine.dispose()


def test_disconnect_revokes_key_and_marks_endpoint_disconnected():
    engine, db = make_database()
    original_key = "enrolled-endpoint-key"
    agent = add_agent(db, name="endpoint", last_seen=datetime.utcnow())
    agent.api_key_hash = hash_secret(original_key)
    alert = add_alert(db, agent_id=agent.id)
    action = create_endpoint_actions(
        db,
        alert_id=alert.alert_id,
        action_type="DISCONNECT_AGENT",
        requested_by="analyst",
    )[0]
    update_endpoint_action(
        db,
        action_id=action.action_id,
        agent_id=agent.id,
        status="RUNNING",
        result=None,
    )

    update_endpoint_action(
        db,
        action_id=action.action_id,
        agent_id=agent.id,
        status="SUCCEEDED",
        result="agent startup disabled",
    )

    assert get_agent_by_api_key(db, original_key) is None
    assert agent_status(agent, now=datetime.utcnow(), timeout_seconds=20) == "Disconnected"
    engine.dispose()


def test_unblock_and_unisolate_queue_only_to_alert_endpoint():
    engine, db = make_database()
    endpoint = add_agent(db, name="endpoint", last_seen=datetime.utcnow())
    other = add_agent(db, name="other", last_seen=datetime.utcnow())
    alert = add_alert(db, agent_id=endpoint.id)

    unblock = create_endpoint_actions(
        db,
        alert_id=alert.alert_id,
        action_type="UNBLOCK_ENDPOINT_IP",
        requested_by="analyst",
    )[0]
    unisolate = create_endpoint_actions(
        db,
        alert_id=alert.alert_id,
        action_type="UNISOLATE_ENDPOINT",
        requested_by="analyst",
    )[0]

    assert unblock.agent_id == endpoint.id == unisolate.agent_id
    assert unblock.target_ip == endpoint.ip_address
    assert other.id not in {unblock.agent_id, unisolate.agent_id}
    engine.dispose()


def test_connect_issues_single_use_token_for_disconnected_endpoint():
    engine, db = make_database()
    endpoint = add_agent(db, name="endpoint", last_seen=datetime.utcnow())
    endpoint.last_seen = datetime(2000, 1, 1)
    db.commit()

    enrolled_agent, token, _ = create_reconnect_token(db, endpoint.id)
    assert enrolled_agent.id == endpoint.id
    assert token
    reconnected, api_key = enroll_agent(
        db,
        token=token,
        version="1.0.0",
        host=endpoint.host,
        ip=endpoint.ip_address,
        os_type=endpoint.os_type,
    )
    assert reconnected.id == endpoint.id
    assert get_agent_by_api_key(db, api_key) is not None
    assert reconnected.last_seen is None
    assert enroll_agent(
        db,
        token=token,
        version="1.0.0",
        host=endpoint.host,
        ip=endpoint.ip_address,
        os_type=endpoint.os_type,
    ) is None
    engine.dispose()