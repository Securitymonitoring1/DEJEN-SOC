import unittest
from datetime import datetime, timezone

from collectors.syslog.parser import SyslogParseError, parse_syslog_message


class SyslogParserTests(unittest.TestCase):
    def test_parses_rfc3164_auth_failure(self):
        event = parse_syslog_message(
            "<34>Oct 15 10:00:00 host01 sshd[321]: Failed password for admin from 192.0.2.8 port 22 ssh2",
            received_at=datetime(2026, 10, 15, tzinfo=timezone.utc),
        )
        self.assertEqual(event["event_type"], "authentication_failed")
        self.assertEqual(event["username"], "admin")
        self.assertEqual(event["source_ip"], "192.0.2.8")
        self.assertEqual(event["raw"]["facility"], 4)
        self.assertEqual(event["host"], "host01")

    def test_parses_rfc5424_success_and_structured_data(self):
        event = parse_syslog_message(
            '<34>1 2026-10-15T10:00:00Z host02 sshd 321 ID47 [meta sequenceId="1"] Accepted publickey for admin from 2001:db8::1 port 22 ssh2'
        )
        self.assertEqual(event["event_type"], "authentication_success")
        self.assertEqual(event["source_ip"], "2001:db8::1")
        self.assertEqual(event["raw"]["message_id"], "ID47")

    def test_rejects_malformed_headers_and_invalid_timestamps(self):
        with self.assertRaises(SyslogParseError):
            parse_syslog_message("not syslog")
        with self.assertRaises(SyslogParseError):
            parse_syslog_message("<34>1 invalid host app 1 id - message")

    def test_decodes_invalid_utf8_with_replacement_and_uses_receive_time_for_nil(self):
        received = datetime(2026, 10, 15, 10, tzinfo=timezone.utc)
        event = parse_syslog_message(
            b"<14>1 - host app - - - message\xff",
            received_at=received,
        )
        self.assertEqual(event["timestamp"], "2026-10-15T10:00:00Z")
        self.assertIn("\ufffd", event["message"])


if __name__ == "__main__":
    unittest.main()