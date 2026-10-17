import ipaddress
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from collectors.common.events import build_event


RFC5424 = re.compile(
    r"^<(?P<priority>\d{1,3})>(?P<version>\d+) "
    r"(?P<timestamp>\S+) (?P<host>\S+) (?P<app>\S+) "
    r"(?P<procid>\S+) (?P<msgid>\S+) "
    r"(?P<structured_data>-|\[.*\])(?: (?P<message>.*))?$"
)
RFC3164 = re.compile(
    r"^<(?P<priority>\d{1,3})>(?P<timestamp>[A-Z][a-z]{2}\s+\d{1,2} "
    r"\d{2}:\d{2}:\d{2}) (?P<host>\S+) "
    r"(?P<tag>[^:\s\[]+)(?:\[(?P<procid>\d+)\])?:? ?(?P<message>.*)$"
)
AUTH_FAILURE = re.compile(r"failed password|authentication failure|invalid user", re.I)
AUTH_SUCCESS = re.compile(r"accepted (?:password|publickey)|session opened", re.I)
USERNAME = re.compile(r"(?:failed|accepted)\s+\S+\s+for\s+(?:invalid user\s+)?(\S+)", re.I)
SOURCE_IP = re.compile(r"(?:\bfrom\s+|\brhost=)([0-9a-fA-F:.]+)", re.I)


class SyslogParseError(ValueError):
    pass


def parse_syslog_message(
    payload: bytes | str,
    *,
    agent_id: str = "syslog",
    received_at: datetime | None = None,
) -> dict[str, Any]:
    if isinstance(payload, bytes):
        text = payload.decode("utf-8", errors="replace").strip("\r\n\x00 ")
    else:
        text = payload.strip("\r\n\x00 ")
    if not text:
        raise SyslogParseError("empty syslog message")

    match = RFC5424.match(text)
    version = 3164
    if match:
        fields = match.groupdict()
        version = 5424
        app = _nil(fields["app"])
        procid = _nil(fields["procid"])
        msgid = _nil(fields["msgid"])
        structured_data = fields["structured_data"]
    else:
        match = RFC3164.match(text)
        if not match:
            raise SyslogParseError("message is not a supported RFC 3164 or RFC 5424 record")
        fields = match.groupdict()
        app = fields["tag"].split("[", 1)[0]
        procid = fields["procid"]
        msgid = None
        structured_data = None

    priority = int(fields["priority"])
    if priority > 191:
        raise SyslogParseError(f"invalid syslog priority: {priority}")
    host = _nil(fields["host"])
    if not host:
        raise SyslogParseError("syslog message has no hostname")

    now = received_at or datetime.now(timezone.utc)
    timestamp = _parse_timestamp(fields["timestamp"], version, now)
    message = fields.get("message") or ""
    facility, syslog_severity = divmod(priority, 8)
    event_type = _event_type(app, message)
    return build_event(
        agent_id=agent_id,
        host=host,
        event_type=event_type,
        message=message,
        timestamp=timestamp,
        severity=_dejen_severity(syslog_severity),
        username=_username(message),
        source_ip=_source_ip(message),
        raw={
            "source": "syslog",
            "original_message": text,
            "facility": facility,
            "syslog_severity": syslog_severity,
            "app_name": app,
            "process_id": procid,
            "message_id": msgid,
            "structured_data": structured_data,
        },
    )


def _nil(value: str | None) -> str | None:
    return None if value in (None, "-") else value


def _parse_timestamp(value: str, version: int, received_at: datetime) -> datetime:
    if value == "-":
        return received_at.astimezone(timezone.utc)
    if version == 5424:
        try:
            timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise SyslogParseError(f"invalid RFC 5424 timestamp: {value}") from error
        if timestamp.tzinfo is None:
            raise SyslogParseError("RFC 5424 timestamp must include a timezone")
        return timestamp.astimezone(timezone.utc)

    try:
        timestamp = datetime.strptime(
            f"{received_at.year} {value}",
            "%Y %b %d %H:%M:%S",
        ).replace(tzinfo=timezone.utc)
    except ValueError as error:
        raise SyslogParseError(f"invalid RFC 3164 timestamp: {value}") from error
    now_utc = (
        received_at.replace(tzinfo=timezone.utc)
        if received_at.tzinfo is None
        else received_at.astimezone(timezone.utc)
    )
    if timestamp > now_utc + timedelta(days=1):
        timestamp = timestamp.replace(year=timestamp.year - 1)
    return timestamp


def _event_type(app: str | None, message: str) -> str:
    if app and app.lower().startswith("sshd"):
        if AUTH_FAILURE.search(message):
            return "authentication_failed"
        if AUTH_SUCCESS.search(message):
            return "authentication_success"
    return "syslog_message"


def _username(message: str) -> str | None:
    match = USERNAME.search(message)
    if match:
        return match.group(1).rstrip(".,:")
    match = re.search(r"\buser=(\S+)", message)
    return match.group(1).rstrip(".,:") if match else None


def _source_ip(message: str) -> str | None:
    for match in SOURCE_IP.finditer(message):
        try:
            return str(ipaddress.ip_address(match.group(1)))
        except ValueError:
            continue
    return None


def _dejen_severity(value: int) -> str:
    if value <= 2:
        return "CRITICAL"
    if value <= 4:
        return "HIGH"
    if value == 5:
        return "MEDIUM"
    return "LOW"