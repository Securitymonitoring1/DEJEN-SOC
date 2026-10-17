import logging
import socketserver
import threading
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from collectors.syslog.parser import SyslogParseError, parse_syslog_message


logger = logging.getLogger(__name__)


class SyslogReceiver:
    def __init__(
        self,
        on_event: Callable[[dict[str, Any]], None],
        *,
        host: str = "127.0.0.1",
        port: int = 5514,
        protocol: str = "udp",
        agent_id: str = "syslog",
        max_message_bytes: int = 65536,
    ) -> None:
        protocol = protocol.lower()
        if protocol not in {"udp", "tcp"}:
            raise ValueError("protocol must be 'udp' or 'tcp'")
        if not 0 <= port <= 65535:
            raise ValueError("port must be between 0 and 65535")
        self.on_event = on_event
        self.host = host
        self.port = port
        self.protocol = protocol
        self.agent_id = agent_id
        self.max_message_bytes = max_message_bytes
        self._server: socketserver.BaseServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def address(self) -> tuple[str, int]:
        if self._server is None:
            return self.host, self.port
        host, port = self._server.server_address[:2]
        return str(host), int(port)

    def start(self) -> tuple[str, int]:
        if self._server is not None:
            raise RuntimeError("receiver is already started")
        self._server = self._create_server()
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            name=f"syslog-{self.protocol}-receiver",
            daemon=True,
        )
        self._thread.start()
        return self.address

    def serve_forever(self) -> None:
        if self._server is not None:
            raise RuntimeError("receiver is already started")
        self._server = self._create_server()
        try:
            self._server.serve_forever()
        finally:
            self._server.server_close()
            self._server = None

    def shutdown(self) -> None:
        server, self._server = self._server, None
        if server is not None:
            server.shutdown()
            server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

    def _create_server(self) -> socketserver.BaseServer:
        receiver = self

        class UDPHandler(socketserver.BaseRequestHandler):
            def handle(self) -> None:
                payload, _socket = self.request
                receiver._handle(payload, self.client_address[0])

        class TCPHandler(socketserver.StreamRequestHandler):
            def handle(self) -> None:
                while True:
                    payload = self.rfile.readline(receiver.max_message_bytes + 1)
                    if not payload:
                        break
                    if len(payload) > receiver.max_message_bytes:
                        logger.warning("Discarding oversized TCP syslog record from %s", self.client_address[0])
                        break
                    receiver._handle(payload, self.client_address[0])

        if self.protocol == "udp":
            server_type = socketserver.ThreadingUDPServer
            handler_type = UDPHandler
        else:
            server_type = socketserver.ThreadingTCPServer
            handler_type = TCPHandler
        server_type.allow_reuse_address = True
        return server_type((self.host, self.port), handler_type)

    def _handle(self, payload: bytes, sender_ip: str) -> None:
        try:
            event = parse_syslog_message(
                payload,
                agent_id=self.agent_id,
                received_at=datetime.now(timezone.utc),
            )
            event["raw"]["sender_ip"] = sender_ip
            self.on_event(event)
        except SyslogParseError:
            logger.warning("Discarding malformed syslog payload from %s", sender_ip)
        except Exception:
            logger.exception("Failed to deliver syslog event from %s", sender_ip)