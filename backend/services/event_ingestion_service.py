from sqlalchemy.orm import Session

from backend.schemas.event import EventCreate
from backend.services.detection_integration_service import detect_event
from backend.services.detection_service import (
    detect_privilege_escalation,
    detect_repeated_host_activity,
    detect_success_after_failures,
    detect_suspicious_ip_activity,
    detect_unusual_login_behavior,
)
from backend.services.event_service import create_event
from backend.services.incident_automation_service import create_incident_from_alert


def ingest_event(db: Session, event_data: EventCreate):
    event = create_event(db, event_data)
    detected_alerts = detect_event(db, event, dest_port=event_data.dest_port)
    for detector in (
        detect_success_after_failures,
        detect_suspicious_ip_activity,
        detect_privilege_escalation,
        detect_unusual_login_behavior,
        detect_repeated_host_activity,
    ):
        alert = detector(db, event)
        if alert:
            detected_alerts.append(alert)
    for alert in detected_alerts:
        create_incident_from_alert(db, alert)
    return event