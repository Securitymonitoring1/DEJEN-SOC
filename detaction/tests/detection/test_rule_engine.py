import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from datetime import datetime, timedelta, timezone
import uuid

from detection.main import DetectionService


def make_event(event_type, source_ip, ts, **kwargs):
    e = {
        "event_id": str(uuid.uuid4()),
        "timestamp": ts.isoformat(),
        "agent_id": "agent-001",
        "host": "ubuntu-01",
        "event_type": event_type,
        "username": "admin",
        "source_ip": source_ip,
        "message": "test event",
        "severity": "LOW",
    }
    e.update(kwargs)
    return e


def test_brute_force_fires_after_5_failed_logins():
    service = DetectionService()
    start = datetime.now(timezone.utc)
    fired = []
    for i in range(5):
        ts = start + timedelta(seconds=i * 10)  # all within 5 min window
        event = make_event("authentication_failed", "10.0.0.99", ts)
        alerts = service.process_event(event)
        fired.extend(alerts)

    brute_force_alerts = [a for a in fired if a["rule_id"] == "brute_force"]
    assert len(brute_force_alerts) == 1, f"expected exactly 1 brute force alert, got {len(brute_force_alerts)}"
    assert brute_force_alerts[0]["severity"] == "HIGH"
    assert len(brute_force_alerts[0]["related_event_ids"]) == 5


def test_brute_force_fires_for_local_events_without_source_ip():
    service = DetectionService()
    start = datetime.now(timezone.utc)
    fired = []
    for i in range(5):
        event = make_event(
            "authentication_failed",
            None,
            start + timedelta(seconds=i * 10),
            host="win-lab-01",
        )
        fired.extend(service.process_event(event))

    brute_force_alerts = [a for a in fired if a["rule_id"] == "brute_force"]
    assert len(brute_force_alerts) == 1
    assert brute_force_alerts[0]["host"] == "win-lab-01"
    assert brute_force_alerts[0]["source_ip"] is None


def test_brute_force_does_not_combine_events_from_different_hosts():
    service = DetectionService()
    start = datetime.now(timezone.utc)
    fired = []
    for i in range(6):
        event = make_event(
            "authentication_failed",
            None,
            start + timedelta(seconds=i * 10),
            host=f"win-lab-{i % 2}",
        )
        fired.extend(service.process_event(event))

    assert not any(a["rule_id"] == "brute_force" for a in fired)


def test_brute_force_can_fire_again_after_window_expires():
    service = DetectionService()
    start = datetime.now(timezone.utc)
    fired = []
    for burst in range(2):
        for i in range(5):
            ts = start + timedelta(seconds=burst * 360 + i * 10)
            event = make_event("authentication_failed", "10.0.0.99", ts)
            fired.extend(service.process_event(event))

    brute_force_alerts = [a for a in fired if a["rule_id"] == "brute_force"]
    assert len(brute_force_alerts) == 2


def test_malware_event_fires_single_event_rule():
    service = DetectionService()
    event = make_event("malware_detected", "10.0.0.5", datetime.now(timezone.utc))
    alerts = service.process_event(event)
    assert any(a["rule_id"] == "malware" for a in alerts)
    malware_alert = [a for a in alerts if a["rule_id"] == "malware"][0]
    assert malware_alert["severity"] == "CRITICAL"


def test_port_scan_requires_10_distinct_ports_within_60_seconds():
    service = DetectionService()
    start = datetime.now(timezone.utc)
    alerts = []
    for port in range(1, 10):
        alerts.extend(
            service.process_event(
                make_event(
                    "connection_attempt",
                    "192.0.2.10",
                    start + timedelta(seconds=port),
                    dest_port=port,
                )
            )
        )
    assert not any(alert["rule_id"] == "port_scan" for alert in alerts)

    alerts.extend(
        service.process_event(
            make_event(
                "connection_attempt",
                "192.0.2.10",
                start + timedelta(seconds=10),
                dest_port=10,
            )
        )
    )
    assert any(alert["rule_id"] == "port_scan" for alert in alerts)


def test_port_scan_does_not_count_repeated_attempts_to_same_port():
    service = DetectionService()
    start = datetime.now(timezone.utc)
    alerts = []
    for attempt in range(12):
        alerts.extend(
            service.process_event(
                make_event(
                    "connection_attempt",
                    "192.0.2.11",
                    start + timedelta(seconds=attempt),
                    dest_port=443,
                )
            )
        )
    assert not any(alert["rule_id"] == "port_scan" for alert in alerts)


def test_explicit_port_scan_detection_event_fires_alert():
    service = DetectionService()
    event = make_event("port_scan_detected", "192.0.2.12", datetime.now(timezone.utc))
    alerts = service.process_event(event)
    assert any(alert["rule_id"] == "port_scan_detected" for alert in alerts)


def test_encoded_powershell_process_creation_fires_alert_case_insensitively():
    service = DetectionService()
    event = make_event(
        "process_creation",
        None,
        datetime.now(timezone.utc),
        host="win-lab-01",
        message="powershell.exe -eNcOdEdCoMmAnD ZQBjAGgAbwA=",
    )

    alerts = service.process_event(event)

    powershell_alerts = [a for a in alerts if a["rule_id"] == "suspicious_powershell"]
    assert len(powershell_alerts) == 1
    assert powershell_alerts[0]["severity"] == "HIGH"


def test_fewer_than_threshold_does_not_fire():
    service = DetectionService()
    start = datetime.now(timezone.utc)
    fired = []
    for i in range(3):  # below threshold of 5
        ts = start + timedelta(seconds=i * 10)
        event = make_event("authentication_failed", "10.0.0.50", ts)
        fired.extend(service.process_event(event))
    assert not any(a["rule_id"] == "brute_force" for a in fired)


def test_reputation_enrichment_escalates_severity():
    def fake_enrich(event):
        return {"ip_score": 95, "is_known_malicious": True, "source": "test"}

    service = DetectionService(enrich_fn=fake_enrich)
    event = make_event("malware_detected", "45.155.205.233", datetime.now(timezone.utc))
    alerts = service.process_event(event)
    malware_alert = [a for a in alerts if a["rule_id"] == "malware"][0]
    # CRITICAL is already max, so it stays CRITICAL, but confidence should be boosted
    assert malware_alert["confidence"] >= 0.9


if __name__ == "__main__":
    test_brute_force_fires_after_5_failed_logins()
    test_brute_force_fires_for_local_events_without_source_ip()
    test_brute_force_does_not_combine_events_from_different_hosts()
    test_brute_force_can_fire_again_after_window_expires()
    test_malware_event_fires_single_event_rule()
    test_encoded_powershell_process_creation_fires_alert_case_insensitively()
    test_fewer_than_threshold_does_not_fire()
    test_reputation_enrichment_escalates_severity()
    print("detection tests passed")
