import unittest

from agent.authlog import parse_auth_line, parse_auth_lines


class AuthLogTests(unittest.TestCase):
    def test_failed_password(self):
        line = (
            "Oct 15 09:10:00 server sshd[1234]: "
            "Failed password for admin from 192.168.1.50 port 2222 ssh2"
        )
        event = parse_auth_line(line, agent_id="linux-test", host="test-server")
        self.assertIsNotNone(event)
        self.assertEqual(event["event_type"], "LOGIN_FAILURE")
        self.assertEqual(event["severity"], "MEDIUM")
        self.assertEqual(event["username"], "admin")
        self.assertEqual(event["source_ip"], "192.168.1.50")
        self.assertEqual(event["agent_id"], "linux-test")
        self.assertEqual(event["host"], "test-server")

    def test_invalid_user_failure(self):
        line = (
            "Oct 15 09:10:00 server sshd[1234]: "
            "Failed password for invalid user attacker "
            "from 10.10.10.50 port 2222 ssh2"
        )
        event = parse_auth_line(line, host="server")
        self.assertEqual(event["event_type"], "LOGIN_FAILURE")
        self.assertEqual(event["username"], "attacker")
        self.assertEqual(event["source_ip"], "10.10.10.50")

    def test_successful_password(self):
        line = (
            "Oct 15 09:11:00 server sshd[1234]: "
            "Accepted password for abx from 192.168.1.20 port 2222 ssh2"
        )
        event = parse_auth_line(line, host="server")
        self.assertEqual(event["event_type"], "LOGIN_SUCCESS")
        self.assertEqual(event["severity"], "LOW")
        self.assertEqual(event["username"], "abx")

    def test_successful_public_key(self):
        line = (
            "Oct 15 09:12:00 server sshd[1234]: "
            "Accepted publickey for abx from 192.168.1.20 port 2222 ssh2"
        )
        event = parse_auth_line(line)
        self.assertEqual(event["event_type"], "LOGIN_SUCCESS")

    def test_unrelated_line_is_ignored(self):
        line = "Oct 15 09:12:00 server systemd[1]: Started a service"
        self.assertIsNone(parse_auth_line(line))

    def test_invalid_ip_is_ignored(self):
        line = (
            "Oct 15 09:12:00 server sshd[1234]: "
            "Failed password for admin from not-an-ip port 2222 ssh2"
        )
        self.assertIsNone(parse_auth_line(line))

    def test_multiple_lines(self):
        lines = [
            "Failed password for admin from 192.168.1.50 port 22 ssh2",
            "Started a service",
            "Accepted password for abx from 192.168.1.20 port 22 ssh2",
        ]
        events = parse_auth_lines(lines, host="server")
        self.assertEqual(len(events), 2)
        self.assertEqual(
            [event["event_type"] for event in events],
            ["LOGIN_FAILURE", "LOGIN_SUCCESS"],
        )


if __name__ == "__main__":
    unittest.main()