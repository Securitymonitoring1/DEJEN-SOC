import ipaddress
import logging
import re
import socket
from datetime import datetime
from pathlib import Path
from typing import Any

from collectors.common.events import build_event


logger = logging.getLogger(__name__)
FAILED_LOGIN = re.compile(
    r"Failed password for (?:invalid user )?(?P<username>\S+) from (?P<ip>\S+)"
)
SUCCESSFUL_LOGIN = re.compile(
    r"Accepted (?:password|publickey) for (?P<username>\S+) from (?P<ip>\S+)"
)
SYSLOG_TIMESTAMP = re.compile(
    r"^(?P<month>[A-Z][a-z]{2})\s+(?P<day>\d{1,2}) "
    r"(?P<time>\d{2}:\d{2}:\d{2})"
)
AUTH_LOG_PATHS = (Path("/var/log/auth.log"), Path("/var/log/secure"))


class LinuxCollectionError(RuntimeError):
    pass


def parse_auth_line(
    line: str,
    *,
    agent_id: str,
    host: str,
    year: int | None = None,
) -> dict[str, Any] | None:
    match = FAILED_LOGIN.search(line)
    if match:
        event_type = "authentication_failed"
        severity = "MEDIUM"
    else:
        match = SUCCESSFUL_LOGIN.search(line)
        if not match:
            return None
        event_type = "authentication_success"
        severity = "LOW"

    source_ip = match.group("ip").rstrip(".,:")
    try:
        source_ip = str(ipaddress.ip_address(source_ip))
    except ValueError:
        return None

    timestamp_match = SYSLOG_TIMESTAMP.match(line)
    timestamp = None
    if timestamp_match:
        timestamp_year = year or datetime.now().year
        timestamp = datetime.strptime(
            f"{timestamp_year} {timestamp_match.group('month')} "
            f"{timestamp_match.group('day')} {timestamp_match.group('time')}",
            "%Y %b %d %H:%M:%S",
        ).astimezone().isoformat()

    username = match.group("username")
    return build_event(
        agent_id=agent_id,
        host=host,
        event_type=event_type,
        message=line.strip()[:5000],
        timestamp=timestamp,
        severity=severity,
        username=username,
        source_ip=source_ip,
        process_name="sshd",
        raw={"source": "linux_agent", "message": line.strip()},
    )


class LinuxAuthCollector:
    def __init__(
        self,
        *,
        agent_id: str,
        host: str | None = None,
        log_path: str | Path | None = None,
    ) -> None:
        self.agent_id = agent_id
        self.host = host or socket.gethostname()
        self.log_path = Path(log_path) if log_path else self._default_log_path()
        self._offset = 0

    @staticmethod
    def _default_log_path() -> Path:
        for path in AUTH_LOG_PATHS:
            if path.is_file():
                return path
        return AUTH_LOG_PATHS[0]

    def collect(self) -> list[dict[str, Any]]:
        try:
            size = self.log_path.stat().st_size
            if size < self._offset:
                self._offset = 0
            with self.log_path.open(encoding="utf-8", errors="replace") as source:
                source.seek(self._offset)
                lines = source.readlines()
                self._offset = source.tell()
        except OSError as error:
            raise LinuxCollectionError(f"Cannot read auth log {self.log_path}: {error}") from error

        events = []
        for line in lines:
            try:
                event = parse_auth_line(
                    line, agent_id=self.agent_id, host=self.host
                )
            except ValueError:
                logger.warning("Skipping malformed auth log timestamp: %s", line.rstrip())
                continue
            if event is not None:
                events.append(event)
        return events