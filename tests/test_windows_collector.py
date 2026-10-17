import json
import subprocess
import unittest
from types import SimpleNamespace

from collectors.agent.collectors.windows import (
    DEFAULT_EVENT_IDS,
    WindowsCollectionError,
    WindowsEventCollector,
)


def make_collector(stdout="", returncode=0, stderr="", event_ids=DEFAULT_EVENT_IDS):
    calls = []

    def runner(command, **kwargs):
        calls.append((command, kwargs))
        return SimpleNamespace(stdout=stdout, returncode=returncode, stderr=stderr)

    collector = WindowsEventCollector(
        agent_id="win-agent",
        host="configured-host",
        interval_seconds=15,
        event_ids=event_ids,
        runner=runner,
    )
    return collector, calls


class WindowsCollectorTests(unittest.TestCase):
    def test_collects_and_normalizes_auth_failure(self):
        record = {
            "EventId": 4625,
            "TimeCreated": "2026-10-15T10:00:00Z",
            "Computer": "WIN01",
            "RecordId": 18,
            "ProviderName": "Microsoft-Windows-Security-Auditing",
            "Message": "An account failed to log on",
            "EventData": {"TargetUserName": "admin", "IpAddress": "192.0.2.4"},
        }
        collector, calls = make_collector(json.dumps(record))

        events = collector.collect()

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "authentication_failed")
        self.assertEqual(events[0]["username"], "admin")
        self.assertEqual(events[0]["source_ip"], "192.0.2.4")
        self.assertEqual(events[0]["host"], "WIN01")
        self.assertEqual(events[0]["severity"], "MEDIUM")
        self.assertIn("@{LogName='Security'", calls[0][0][-1])

    def test_skips_unsupported_and_missing_timestamp_records(self):
        records = [
            {"EventId": 9999, "TimeCreated": "2026-10-15T10:00:00Z"},
            {"EventId": 4624, "Computer": "WIN01"},
        ]
        collector, _ = make_collector(json.dumps(records))
        self.assertEqual(collector.collect(), [])

    def test_collects_and_normalizes_process_creation(self):
        record = {
            "EventId": 4688,
            "TimeCreated": "2026-10-15T10:00:00Z",
            "Computer": "WIN01",
            "RecordId": 19,
            "ProviderName": "Microsoft-Windows-Security-Auditing",
            "Message": "Creator Subject:\\n\\tAccount Name: analyst\\nProcess Information:",
            "EventData": {
                "SubjectUserName": "analyst",
                "SubjectUserSid": "S-1-5-21-test",
                "NewProcessName": "powershell.exe",
                "CommandLine": "powershell.exe -EncodedCommand ZQBjAGgAbwA=",
            },
        }
        collector, calls = make_collector(json.dumps(record))

        events = collector.collect()

        self.assertIn("4688", calls[0][0][-1])
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "process_creation")
        self.assertEqual(events[0]["username"], "analyst")
        self.assertIn("-EncodedCommand", events[0]["message"])
        self.assertNotIn("Account Name", events[0]["message"])
        self.assertNotIn("SubjectUserSid", events[0]["raw"]["event_data"])

    def test_skips_ordinary_process_creation_events(self):
        record = {
            "EventId": 4688,
            "TimeCreated": "2026-10-15T10:00:00Z",
            "Computer": "WIN01",
            "RecordId": 20,
            "Message": "A new process has been created. Process Command Line: notepad.exe",
            "EventData": {"NewProcessName": "C:\\Windows\\System32\\notepad.exe", "CommandLine": "notepad.exe"},
        }
        collector, _ = make_collector(json.dumps(record))

        self.assertEqual(collector.collect(), [])

    def test_does_not_forward_subject_details_for_routine_4688(self):
        record = {
            "EventId": 4688,
            "TimeCreated": "2026-10-15T10:00:00Z",
            "Computer": "WIN01",
            "RecordId": 21,
            "Message": "A new process has been created.\\n\\nCreator Subject:\\n\\tSecurity ID: S-1-5-21-test\\n\\tAccount Name: ntesf\\n\\tAccount Domain: DESKTOP-TEST\\n\\tLogon ID: 0x37C",
            "EventData": {
                "SubjectUserName": "ntesf",
                "SubjectUserSid": "S-1-5-21-test",
                "CommandLine": "notepad.exe",
            },
        }
        collector, _ = make_collector(json.dumps(record))

        self.assertEqual(collector.collect(), [])

    def test_handles_empty_logs_and_collection_failures(self):
        collector, _ = make_collector("  ")
        self.assertEqual(collector.collect(), [])
        failing_collector, _ = make_collector(returncode=1, stderr="Access denied")
        with self.assertRaisesRegex(WindowsCollectionError, "Access denied"):
            failing_collector.collect()

    def test_rejects_invalid_json(self):
        collector, _ = make_collector("{")
        with self.assertRaisesRegex(WindowsCollectionError, "invalid JSON"):
            collector.collect()

    def test_record_ids_produce_stable_event_ids(self):
        record = {
            "EventId": 4625,
            "TimeCreated": "2026-10-15T10:00:00Z",
            "Computer": "WIN01",
            "RecordId": 18,
            "EventData": {},
        }
        collector, _ = make_collector(json.dumps(record))
        self.assertEqual(collector.collect()[0]["event_id"], collector.collect()[0]["event_id"])


if __name__ == "__main__":
    unittest.main()