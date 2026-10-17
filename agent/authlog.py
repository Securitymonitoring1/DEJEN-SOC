"""Parse Linux SSH authentication logs into Dejen event records."""

import ipaddress
import re
import socket


FAILED_RE = re.compile(
    r"Failed password for (?:invalid user )?"
    r"(?P<username>\S+) from (?P<ip>\S+)"
)
ACCEPTED_RE = re.compile(
    r"Accepted password for (?P<username>\S+) from (?P<ip>\S+)"
)
ACCEPTED_PUBLICKEY_RE = re.compile(
    r"Accepted publickey for (?P<username>\S+) from (?P<ip>\S+)"
)


def parse_auth_line(
    line: str,
    agent_id: str | None = None,
    host: str | None = None,
) -> dict | None:
    """Convert a recognized SSH login message into a Dejen event."""
    match = FAILED_RE.search(line)
    if match:
        event_type = "LOGIN_FAILURE"
        severity = "MEDIUM"
    else:
        match = ACCEPTED_RE.search(line) or ACCEPTED_PUBLICKEY_RE.search(line)
        if match:
            event_type = "LOGIN_SUCCESS"
            severity = "LOW"
        else:
            return None

    username = match.group("username")
    source_ip = match.group("ip").rstrip(".,:")
    try:
        source_ip = str(ipaddress.ip_address(source_ip))
    except ValueError:
        return None

    hostname = host or socket.gethostname()
    return {
        "agent_id": agent_id or f"linux-{hostname}",
        "host": hostname,
        "event_type": event_type,
        "username": username,
        "source_ip": source_ip,
        "message": line.strip()[:5000],
        "severity": severity,
    }


def parse_auth_lines(
    lines: list[str],
    agent_id: str | None = None,
    host: str | None = None,
) -> list[dict]:
    """Parse multiple lines, ignoring messages we do not recognize."""
    events = []
    for line in lines:
        event = parse_auth_line(line, agent_id=agent_id, host=host)
        if event is not None:
            events.append(event)
    return events