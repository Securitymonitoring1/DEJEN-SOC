from datetime import datetime, timedelta

from sqlalchemy import select

from backend.database.postgres import SessionLocal
from backend.models.alert import Alert
from backend.models.event import Event
from backend.models.incident import Incident


SAMPLE_PREFIX = "DEJEN-SAMPLE"


def seed_incident_sample(db, now: datetime) -> None:
    event = db.scalar(
        select(Event).where(Event.agent_id == f"{SAMPLE_PREFIX}-AGENT-07")
    )
    if event is None:
        event = Event(
            timestamp=now - timedelta(hours=42),
            agent_id=f"{SAMPLE_PREFIX}-AGENT-07",
            host="LINUX-FIN-03",
            event_type="authentication_failure",
            username="finance.admin",
            source_ip="198.51.100.77",
            message="Repeated failed authentication attempts against a finance administrator account.",
            severity="HIGH",
        )
        db.add(event)
        db.flush()

    alert = db.scalar(
        select(Alert).where(Alert.event_id == event.event_id)
    )
    if alert is None:
        alert = Alert(
            event_id=event.event_id,
            rule_name="Finance Account Brute Force",
            title="Repeated login failures on LINUX-FIN-03",
            description="Repeated authentication failures targeted the finance administrator account.",
            severity="HIGH",
            risk_score=84,
            status="OPEN",
        )
        db.add(alert)
        db.flush()

    incident = db.scalar(
        select(Incident).where(Incident.alert_id == alert.alert_id)
    )
    if incident is None:
        db.add(
            Incident(
                alert_id=alert.alert_id,
                title="Brute-force attempt against finance administrator",
                description="Review authentication activity, confirm whether the account was accessed, and block the source if the attempts are unauthorized.",
                severity="HIGH",
                status="OPEN",
                assigned_to=None,
            )
        )
        db.commit()
        print("Added a sample incident with its related event and alert.")
    else:
        print("Sample incident already exists.")


def seed_samples() -> None:
    db = SessionLocal()

    try:
        now = datetime.utcnow()
        seed_incident_sample(db, now)

        existing = db.scalar(
            select(Event).where(Event.agent_id == f"{SAMPLE_PREFIX}-AGENT-01")
        )
        if existing:
            print("Sample security records already exist.")
            return

        events = [
            Event(
                timestamp=now - timedelta(minutes=8),
                agent_id=f"{SAMPLE_PREFIX}-AGENT-01",
                host="WIN-FIN-042",
                event_type="process_creation",
                username="sarah.chen",
                source_ip="185.220.101.4",
                message="Encoded PowerShell launched from an Office child process.",
                severity="CRITICAL",
            ),
            Event(
                timestamp=now - timedelta(minutes=19),
                agent_id=f"{SAMPLE_PREFIX}-AGENT-02",
                host="LINUX-API-07",
                event_type="authentication_failure",
                username="deploy",
                source_ip="203.0.113.44",
                message="Repeated SSH authentication failures from an external address.",
                severity="HIGH",
            ),
            Event(
                timestamp=now - timedelta(minutes=34),
                agent_id=f"{SAMPLE_PREFIX}-AGENT-03",
                host="WIN-DC-01",
                event_type="privilege_change",
                username="maria.lopez",
                source_ip="10.24.8.19",
                message="A user was added to the Domain Admins group outside the change window.",
                severity="HIGH",
            ),
            Event(
                timestamp=now - timedelta(hours=1, minutes=12),
                agent_id=f"{SAMPLE_PREFIX}-AGENT-04",
                host="MAC-DESIGN-12",
                event_type="malware_scan",
                username="noah.williams",
                source_ip="10.24.16.72",
                message="Endpoint scan quarantined a suspicious executable in a temporary directory.",
                severity="MEDIUM",
            ),
            Event(
                timestamp=now - timedelta(hours=2),
                agent_id=f"{SAMPLE_PREFIX}-AGENT-05",
                host="K8S-PROD-INGRESS",
                event_type="network_connection",
                username=None,
                source_ip="198.51.100.23",
                message="Container workload contacted an unapproved external destination.",
                severity="MEDIUM",
            ),
            Event(
                timestamp=now - timedelta(hours=3, minutes=20),
                agent_id=f"{SAMPLE_PREFIX}-AGENT-06",
                host="WIN-HR-018",
                event_type="policy_violation",
                username="jordan.patel",
                source_ip="10.24.12.53",
                message="Sensitive archive was copied to a removable drive.",
                severity="LOW",
            ),
        ]
        db.add_all(events)
        db.flush()

        alerts = [
            Alert(
                event_id=events[0].event_id,
                rule_name="Suspicious PowerShell Execution",
                title="Encoded PowerShell launched on WIN-FIN-042",
                description="A base64-encoded command was spawned by an Office process and connected to a known hostile address.",
                severity="CRITICAL",
                risk_score=96,
                status="INVESTIGATING",
            ),
            Alert(
                event_id=events[1].event_id,
                rule_name="Brute Force Detection",
                title="SSH brute-force activity against LINUX-API-07",
                description="The deploy account received 47 failed authentication attempts in five minutes.",
                severity="HIGH",
                risk_score=82,
                status="OPEN",
            ),
            Alert(
                event_id=events[2].event_id,
                rule_name="Privileged Group Change",
                title="Unexpected Domain Admins membership change",
                description="A privileged group membership changed outside the approved maintenance window.",
                severity="HIGH",
                risk_score=88,
                status="OPEN",
            ),
            Alert(
                event_id=events[3].event_id,
                rule_name="Endpoint Malware Prevention",
                title="Potential malware quarantined on MAC-DESIGN-12",
                description="The endpoint sensor quarantined a suspicious executable before it could run.",
                severity="MEDIUM",
                risk_score=54,
                status="RESOLVED",
            ),
        ]
        db.add_all(alerts)
        db.flush()

        db.add_all(
            [
                Incident(
                    alert_id=alerts[0].alert_id,
                    title="Suspected finance workstation compromise",
                    description="Investigate the PowerShell execution chain, validate the user session, and contain WIN-FIN-042 if command-and-control activity is confirmed.",
                    severity="CRITICAL",
                    status="INVESTIGATING",
                    assigned_to="alex.morgan",
                ),
                Incident(
                    alert_id=alerts[2].alert_id,
                    title="Unauthorized privileged access change",
                    description="Confirm the change owner, review recent Domain Admin activity, and remove unauthorized membership.",
                    severity="HIGH",
                    status="OPEN",
                    assigned_to=None,
                ),
            ]
        )
        db.commit()
        print("Added 6 sample events, 4 alerts, and 2 incidents.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_samples()