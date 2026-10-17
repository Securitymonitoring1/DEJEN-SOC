import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from ingest.normalizer import normalize_event, NormalizationError
from ingest.parser import parse_raw_event


def test_normalize_basic_agent_event():
    raw = {
        "source": "linux_agent",
        "event_id": "abc-123",
        "timestamp": "2026-09-16T10:00:00Z",
        "agent_id": "agent-001",
        "host": "ubuntu-01",
        "event_type": "authentication_failed",
        "username": "admin",
        "source_ip": "192.168.1.20",
        "message": "Failed password for admin",
    }
    parsed = parse_raw_event(raw)
    normalized = normalize_event(parsed)
    assert normalized["event_id"] == "abc-123"
    assert normalized["severity"] == "LOW"  # default for auth_failed
    assert normalized["source_ip"] == "192.168.1.20"


def test_normalize_missing_host_raises():
    parsed = {"event_id": "x", "event_type": "authentication_failed", "message": "no host"}
    try:
        normalize_event(parsed)
        assert False, "expected NormalizationError"
    except NormalizationError:
        pass


def test_normalize_generates_id_if_missing():
    parsed = {"host": "h1", "event_type": "process_start", "message": "started"}
    normalized = normalize_event(parsed)
    assert normalized["event_id"]  # generated uuid, non-empty


if __name__ == "__main__":
    test_normalize_basic_agent_event()
    test_normalize_missing_host_raises()
    test_normalize_generates_id_if_missing()
    print("ingest/normalizer tests passed")
