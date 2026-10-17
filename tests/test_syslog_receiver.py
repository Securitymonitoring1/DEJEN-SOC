import socket
import threading
import unittest

from collectors.syslog.receiver import SyslogReceiver


class SyslogReceiverTests(unittest.TestCase):
    def test_receives_udp_and_shuts_down_cleanly(self):
        received = []
        delivered = threading.Event()

        def on_event(event):
            received.append(event)
            delivered.set()

        receiver = SyslogReceiver(on_event, port=0, protocol="udp")
        host, port = receiver.start()
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as client:
                client.sendto(
                    b"<34>Oct 15 10:00:00 host01 sshd[321]: Failed password for admin from 192.0.2.8 port 22 ssh2",
                    (host, port),
                )
            self.assertTrue(delivered.wait(2))
            self.assertEqual(received[0]["event_type"], "authentication_failed")
            self.assertEqual(received[0]["raw"]["sender_ip"], "127.0.0.1")
        finally:
            receiver.shutdown()
        self.assertIsNone(receiver._server)

    def test_discards_invalid_udp_payload(self):
        received = []
        receiver = SyslogReceiver(received.append, port=0, protocol="udp")
        host, port = receiver.start()
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as client:
                client.sendto(b"bad", (host, port))
            self.assertEqual(received, [])
        finally:
            receiver.shutdown()

    def test_receives_newline_delimited_tcp(self):
        received = []
        delivered = threading.Event()

        def on_event(event):
            received.append(event)
            delivered.set()

        receiver = SyslogReceiver(on_event, port=0, protocol="tcp")
        host, port = receiver.start()
        try:
            with socket.create_connection((host, port), timeout=2) as client:
                client.sendall(
                    b"<34>1 2026-10-15T10:00:00Z host02 sshd 321 ID47 - Accepted publickey for admin from 192.0.2.9 port 22 ssh2\n"
                )
            self.assertTrue(delivered.wait(2))
            self.assertEqual(received[0]["event_type"], "authentication_success")
        finally:
            receiver.shutdown()


if __name__ == "__main__":
    unittest.main()