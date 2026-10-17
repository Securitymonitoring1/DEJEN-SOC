import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from collectors.agent.collectors.linux import LinuxAuthCollector, parse_auth_line


class LinuxCollectorTests(unittest.TestCase):
    def test_parses_failed_login_with_normalized_fields(self):
        line = "Oct 15 10:11:12 host sshd[123]: Failed password for invalid user alice from 192.0.2.10 port 22 ssh2"

        event = parse_auth_line(line, agent_id="linux-test", host="host", year=2026)

        self.assertEqual(event["event_type"], "authentication_failed")
        self.assertEqual(event["severity"], "MEDIUM")
        self.assertEqual(event["username"], "alice")
        self.assertEqual(event["source_ip"], "192.0.2.10")
        self.assertEqual(event["process_name"], "sshd")
        self.assertEqual(event["raw"]["source"], "linux_agent")
        expected_timestamp = datetime.strptime(
            "2026-10-15 10:11:12", "%Y-%m-%d %H:%M:%S"
        ).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        self.assertEqual(event["timestamp"], expected_timestamp)

    def test_parses_successful_public_key_login_and_ignores_unrelated_lines(self):
        event = parse_auth_line(
            "Accepted publickey for bob from 2001:db8::1 port 22 ssh2",
            agent_id="linux-test",
            host="host",
        )

        self.assertEqual(event["event_type"], "authentication_success")
        self.assertEqual(event["source_ip"], "2001:db8::1")
        self.assertIsNone(
            parse_auth_line("systemd: Started a service", agent_id="a", host="h")
        )

    def test_reads_only_new_auth_log_lines(self):
        with tempfile.TemporaryDirectory() as temporary:
            log_path = Path(temporary) / "auth.log"
            log_path.write_text(
                "Oct 15 10:11:12 host sshd[123]: Failed password for alice from 192.0.2.10 port 22 ssh2\n",
                encoding="utf-8",
            )
            collector = LinuxAuthCollector(
                agent_id="linux-test", host="host", log_path=log_path
            )

            self.assertEqual(len(collector.collect()), 1)
            self.assertEqual(collector.collect(), [])


if __name__ == "__main__":
    unittest.main()