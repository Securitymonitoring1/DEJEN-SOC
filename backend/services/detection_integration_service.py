from backend.models.alert import Alert
from backend.models.event import Event
from detaction.detection.main import DetectionService


_detection_service = DetectionService()
_EVENT_TYPE_ALIASES = {
    "LOGIN_FAILURE": "authentication_failed",
    "LOGIN_SUCCESS": "authentication_success",
}


def detect_event(db, event: Event, *, dest_port: int | None = None) -> list[Alert]:
    event_type = _EVENT_TYPE_ALIASES.get(
        event.event_type.upper(),
        event.event_type.lower(),
    )
    detections = _detection_service.process_event(
        {
            "event_id": str(event.event_id),
            "timestamp": event.timestamp.isoformat(),
            "agent_id": event.agent_id,
            "host": event.host,
            "event_type": event_type,
            "username": event.username,
            "source_ip": str(event.source_ip) if event.source_ip else None,
            "dest_port": dest_port,
            "message": event.message,
            "severity": event.severity,
        }
    )

    alerts = []
    for detection in detections:
        mitre_technique = detection.get("mitre_technique")
        description = detection["description"]
        if mitre_technique:
            description = f"{description} MITRE ATT&CK: {mitre_technique}."

        confidence = float(detection.get("confidence", 0))
        alert = Alert(
            event_id=event.event_id,
            rule_name=detection["rule_name"],
            title=detection["rule_name"],
            description=description,
            severity=detection["severity"],
            risk_score=max(0, min(100, round(confidence * 100))),
            status="OPEN",
        )
        db.add(alert)
        db.flush()
        alerts.append(alert)

    if alerts:
        db.commit()
        for alert in alerts:
            db.refresh(alert)

    return alerts