from datetime import datetime, timedelta

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.database.base import Base
from backend.models.agent import Agent, EnrollmentToken
from backend.services.agent_service import (
    agent_status,
    create_enrollment_token,
    enroll_agent,
    get_agent_by_api_key,
    hash_secret,
)


def test_enrollment_is_single_use_and_agent_status_tracks_heartbeat():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        token, _ = create_enrollment_token(
            db, name="lab-win", os_type="windows", expires_in_minutes=15
        )
        agent = db.scalar(select(Agent))
        assert agent is not None
        assert agent.last_seen is None
        assert agent_status(agent, now=datetime.utcnow(), timeout_seconds=90) == "Never connected"
        assert db.get(EnrollmentToken, hash_secret(token)) is not None

        enrolled, api_key = enroll_agent(
            db,
            token=token,
            version="1.0.0",
            host="win-lab",
            ip="192.168.56.10",
        )

        assert enrolled.id == agent.id
        assert enrolled.ip_address == "192.168.56.10"
        assert get_agent_by_api_key(db, api_key) is not None
        assert enrolled.api_key_hash != api_key
        assert agent_status(enrolled, now=datetime.utcnow(), timeout_seconds=90) == "Never connected"
        enrolled.last_seen = datetime.utcnow()
        assert agent_status(enrolled, now=datetime.utcnow(), timeout_seconds=90) == "Active"
        assert enroll_agent(db, token=token, version="1", host=None, ip=None) is None
        assert agent_status(
            enrolled,
            now=datetime.utcnow() + timedelta(seconds=91),
            timeout_seconds=90,
        ) == "Disconnected"
    engine.dispose()


def test_expired_enrollment_token_is_rejected():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        token, _ = create_enrollment_token(
            db, name="lab-linux", os_type="linux", expires_in_minutes=15
        )
        record = db.get(EnrollmentToken, hash_secret(token))
        assert record is not None
        record.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()

        assert enroll_agent(db, token=token, version="1.0.0", host=None, ip=None) is None
    engine.dispose()


def test_enrollment_token_rejects_a_different_agent_os():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        token, _ = create_enrollment_token(
            db, name="mac-lab", os_type="macos", expires_in_minutes=15
        )

        assert enroll_agent(
            db,
            token=token,
            version="1.0.0",
            host="mac-lab",
            ip=None,
            os_type="linux",
        ) is None
        enrolled = enroll_agent(
            db,
            token=token,
            version="1.0.0",
            host="mac-lab",
            ip=None,
            os_type="macos",
        )
        assert enrolled is not None
    engine.dispose()