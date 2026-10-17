import unittest
from uuid import UUID

from collectors.common.events import EventContractError, build_event, validate_event


class CollectorEventTests(unittest.TestCase):
    def test_builds_schema_event_with_uuid_and_utc_timestamp(self):
        event = build_event(
            agent_id="agent-1",
            host="host-1",
            event_type="authentication_failed",
            message="Login failed",
            timestamp="2026-10-15T10:00:00+02:00",
        )

        UUID(event["event_id"])
        self.assertEqual(event["timestamp"], "2026-10-15T08:00:00Z")
        self.assertEqual(event["severity"], "LOW")
        self.assertNotIn("source_ip", event)

    def test_preserves_supported_optional_fields(self):
        event = build_event(
            agent_id="agent-1",
            host="host-1",
            event_type="file_modified",
            message="File changed",
            file_path="/tmp/example",
            file_hash="abc123",
            raw={"source": "test"},
        )

        self.assertEqual(event["file_path"], "/tmp/example")
        self.assertEqual(event["file_hash"], "abc123")
        self.assertEqual(event["raw"], {"source": "test"})

    def test_rejects_invalid_timestamp_and_severity(self):
        base = {
            "agent_id": "agent-1",
            "host": "host-1",
            "event_type": "syslog_message",
            "message": "message",
        }
        with self.assertRaises(EventContractError):
            build_event(**base, timestamp="not-a-time")
        with self.assertRaises(EventContractError):
            build_event(**base, severity="NOTICE")
        normalized = build_event(**base, timestamp="2026-10-15T10:00:00+02:00")
        self.assertEqual(normalized["timestamp"], "2026-10-15T08:00:00Z")
        with self.assertRaises(EventContractError):
            validate_event(normalized | {"timestamp": "2026-10-15T10:00:00+02:00"})
        with self.assertRaises(EventContractError):
            build_event(**base, dest_port="22")


if __name__ == "__main__":
    unittest.main()