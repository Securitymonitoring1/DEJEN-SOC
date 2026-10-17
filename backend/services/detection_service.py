from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models.alert import Alert
from backend.models.event import Event


# ============================================================
# RULE 1: BRUTE-FORCE LOGIN
# ============================================================

BRUTE_FORCE_THRESHOLD = 5
BRUTE_FORCE_WINDOW_MINUTES = 5


def detect_brute_force(
    db: Session,
    event: Event,
) -> Alert | None:

    if event.event_type != "LOGIN_FAILURE":
        return None

    if not event.source_ip:
        return None

    window_start = datetime.utcnow() - timedelta(
        minutes=BRUTE_FORCE_WINDOW_MINUTES
    )

    statement = select(
        func.count(Event.event_id)
    ).where(
        Event.event_type == "LOGIN_FAILURE",
        Event.source_ip == event.source_ip,
        Event.timestamp >= window_start,
    )

    failure_count = db.scalar(statement) or 0

    if failure_count < BRUTE_FORCE_THRESHOLD:
        return None

    existing_alert_statement = (
        select(Alert)
        .join(
            Event,
            Alert.event_id == Event.event_id,
        )
        .where(
            Alert.rule_name == "BRUTE_FORCE_LOGIN",
            Alert.status != "RESOLVED",
            Event.source_ip == event.source_ip,
            Alert.created_at >= window_start,
        )
    )

    existing_alert = db.scalar(
        existing_alert_statement
    )

    if existing_alert:
        return None

    alert = Alert(
        event_id=event.event_id,
        rule_name="BRUTE_FORCE_LOGIN",
        title="Possible Brute-Force Attack",
        description=(
            f"{failure_count} failed login attempts detected "
            f"from source IP {event.source_ip} "
            f"within {BRUTE_FORCE_WINDOW_MINUTES} minutes."
        ),
        severity="HIGH",
        risk_score=80,
        status="OPEN",
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert


# ============================================================
# RULE 2: SUCCESSFUL LOGIN AFTER MULTIPLE FAILURES
# ============================================================

SUCCESS_AFTER_FAILURE_THRESHOLD = 3
SUCCESS_AFTER_FAILURE_WINDOW_MINUTES = 5


def detect_success_after_failures(
    db: Session,
    event: Event,
) -> Alert | None:

    if event.event_type != "LOGIN_SUCCESS":
        return None

    if not event.source_ip:
        return None

    window_start = datetime.utcnow() - timedelta(
        minutes=SUCCESS_AFTER_FAILURE_WINDOW_MINUTES
    )

    statement = select(
        func.count(Event.event_id)
    ).where(
        Event.event_type == "LOGIN_FAILURE",
        Event.source_ip == event.source_ip,
        Event.timestamp >= window_start,
        Event.timestamp < event.timestamp,
    )

    failure_count = db.scalar(statement) or 0

    if failure_count < SUCCESS_AFTER_FAILURE_THRESHOLD:
        return None

    existing_alert_statement = (
        select(Alert)
        .join(
            Event,
            Alert.event_id == Event.event_id,
        )
        .where(
            Alert.rule_name == "SUCCESS_AFTER_FAILURES",
            Alert.status != "RESOLVED",
            Event.source_ip == event.source_ip,
            Alert.created_at >= window_start,
        )
    )

    existing_alert = db.scalar(
        existing_alert_statement
    )

    if existing_alert:
        return None

    alert = Alert(
        event_id=event.event_id,
        rule_name="SUCCESS_AFTER_FAILURES",
        title="Successful Login After Multiple Failures",
        description=(
            f"A successful login occurred from source IP "
            f"{event.source_ip} after {failure_count} "
            f"failed login attempts within "
            f"{SUCCESS_AFTER_FAILURE_WINDOW_MINUTES} minutes."
        ),
        severity="CRITICAL",
        risk_score=90,
        status="OPEN",
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert
# ============================================================
# RULE 3: SUSPICIOUS IP ACTIVITY
# ============================================================

SUSPICIOUS_IP_USER_THRESHOLD = 3
SUSPICIOUS_IP_WINDOW_MINUTES = 5


def detect_suspicious_ip_activity(
    db: Session,
    event: Event,
) -> Alert | None:

    if not event.source_ip:
        return None

    window_start = datetime.utcnow() - timedelta(
        minutes=SUSPICIOUS_IP_WINDOW_MINUTES
    )

    statement = select(
        func.count(func.distinct(Event.username))
    ).where(
        Event.source_ip == event.source_ip,
        Event.username.is_not(None),
        Event.timestamp >= window_start,
    )

    distinct_user_count = db.scalar(statement) or 0

    if distinct_user_count < SUSPICIOUS_IP_USER_THRESHOLD:
        return None

    existing_alert_statement = (
        select(Alert)
        .join(
            Event,
            Alert.event_id == Event.event_id,
        )
        .where(
            Alert.rule_name == "SUSPICIOUS_IP_ACTIVITY",
            Alert.status != "RESOLVED",
            Event.source_ip == event.source_ip,
            Alert.created_at >= window_start,
        )
    )

    existing_alert = db.scalar(
        existing_alert_statement
    )

    if existing_alert:
        return None

    alert = Alert(
        event_id=event.event_id,
        rule_name="SUSPICIOUS_IP_ACTIVITY",
        title="Suspicious IP Activity Detected",
        description=(
            f"Source IP {event.source_ip} interacted with "
            f"{distinct_user_count} different usernames within "
            f"{SUSPICIOUS_IP_WINDOW_MINUTES} minutes."
        ),
        severity="HIGH",
        risk_score=85,
        status="OPEN",
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert
# ============================================================
# RULE 4: PRIVILEGE ESCALATION
# ============================================================

PRIVILEGE_ESCALATION_EVENT_TYPES = {
    "PRIVILEGE_ESCALATION",
    "UNAUTHORIZED_ADMIN_ACCESS",
    "ROLE_CHANGE",
}


def detect_privilege_escalation(
    db: Session,
    event: Event,
) -> Alert | None:

    if event.event_type not in PRIVILEGE_ESCALATION_EVENT_TYPES:
        return None

    existing_alert_statement = (
        select(Alert)
        .join(
            Event,
            Alert.event_id == Event.event_id,
        )
        .where(
            Alert.rule_name == "PRIVILEGE_ESCALATION",
            Alert.status != "RESOLVED",
            Event.username == event.username,
        )
    )

    existing_alert = db.scalar(
        existing_alert_statement
    )

    if existing_alert:
        return None

    alert = Alert(
        event_id=event.event_id,
        rule_name="PRIVILEGE_ESCALATION",
        title="Possible Privilege Escalation",
        description=(
            f"User {event.username or 'unknown'} generated a "
            f"privileged access event: {event.event_type}."
        ),
        severity="CRITICAL",
        risk_score=95,
        status="OPEN",
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert
# ============================================================
# RULE 5: UNUSUAL LOGIN BEHAVIOR
# ============================================================

def detect_unusual_login_behavior(
    db: Session,
    event: Event,
) -> Alert | None:

    if event.event_type != "LOGIN_SUCCESS":
        return None

    if not event.username or not event.source_ip:
        return None

    # Check whether this user has successfully logged in
    # from this IP before this event.
    previous_login_statement = select(Event).where(
        Event.event_type == "LOGIN_SUCCESS",
        Event.username == event.username,
        Event.source_ip == event.source_ip,
        Event.timestamp < event.timestamp,
    ).limit(1)

    previous_login = db.scalar(previous_login_statement)

    # If this IP has been used successfully by the user before,
    # the login is not unusual according to this MVP rule.
    if previous_login:
        return None

    # Check whether the user has successfully logged in before
    # from any other IP.
    previous_user_login_statement = select(Event).where(
        Event.event_type == "LOGIN_SUCCESS",
        Event.username == event.username,
        Event.timestamp < event.timestamp,
    ).limit(1)

    previous_user_login = db.scalar(
        previous_user_login_statement
    )

    # If this is the user's first-ever successful login,
    # we don't have enough history to call it unusual.
    if not previous_user_login:
        return None

    existing_alert_statement = (
        select(Alert)
        .join(
            Event,
            Alert.event_id == Event.event_id,
        )
        .where(
            Alert.rule_name == "UNUSUAL_LOGIN_BEHAVIOR",
            Alert.status != "RESOLVED",
            Event.username == event.username,
            Event.source_ip == event.source_ip,
        )
    )

    existing_alert = db.scalar(
        existing_alert_statement
    )

    if existing_alert:
        return None

    alert = Alert(
        event_id=event.event_id,
        rule_name="UNUSUAL_LOGIN_BEHAVIOR",
        title="Unusual Login Behavior Detected",
        description=(
            f"User {event.username} successfully logged in "
            f"from a new source IP {event.source_ip}."
        ),
        severity="HIGH",
        risk_score=75,
        status="OPEN",
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert
# ============================================================
# RULE 6: REPEATED HOST ACTIVITY
# ============================================================

def detect_repeated_host_activity(
    db: Session,
    event: Event,
) -> Alert | None:

    if not event.host:
        return None

    window_start = event.timestamp - timedelta(minutes=5)

    statement = select(Event).where(
        Event.host == event.host,
        Event.timestamp >= window_start,
        Event.timestamp <= event.timestamp,
    )

    recent_events = db.scalars(statement).all()

    if len(recent_events) < 5:
        return None

    existing_alert_statement = select(Alert).where(
        Alert.rule_name == "REPEATED_HOST_ACTIVITY",
        Alert.status != "RESOLVED",
        Alert.event_id.in_(
            [item.event_id for item in recent_events]
        ),
    )

    existing_alert = db.scalar(
        existing_alert_statement
    )

    if existing_alert:
        return None

    alert = Alert(
        event_id=event.event_id,
        rule_name="REPEATED_HOST_ACTIVITY",
        title="Repeated Host Activity Detected",
        description=(
            f"Host {event.host} generated "
            f"{len(recent_events)} events within 5 minutes."
        ),
        severity="HIGH",
        risk_score=85,
        status="OPEN",
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert
