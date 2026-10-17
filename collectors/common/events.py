from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4


VALID_SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
OPTIONAL_EVENT_FIELDS = (
    "username",
    "source_ip",
    "dest_ip",
    "dest_port",
    "process_name",
    "file_path",
    "file_hash",
    "raw",
)


class EventContractError(ValueError):
    pass


def validate_event(event: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(event, dict):
        raise EventContractError("event must be an object")
    required = {
        "event_id",
        "timestamp",
        "agent_id",
        "host",
        "event_type",
        "message",
        "severity",
    }
    missing = required - event.keys()
    if missing:
        raise EventContractError(f"missing required event fields: {', '.join(sorted(missing))}")
    if not isinstance(event["event_id"], str):
        raise EventContractError("event_id must be a UUID string")
    try:
        UUID(event["event_id"])
    except (TypeError, ValueError, AttributeError) as error:
        raise EventContractError("event_id must be a UUID") from error
    if not isinstance(event["timestamp"], str):
        raise EventContractError("timestamp must be an ISO 8601 string")
    try:
        timestamp = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
    except ValueError as error:
        raise EventContractError("timestamp must be an ISO 8601 datetime") from error
    if timestamp.tzinfo is None:
        raise EventContractError("timestamp must include a UTC offset")
    if timestamp.utcoffset() != timedelta(0):
        raise EventContractError("timestamp must be normalized to UTC")
    for field in ("agent_id", "host", "event_type", "message"):
        if not isinstance(event[field], str) or not event[field].strip():
            raise EventContractError(f"{field} must be a non-empty string")
    if not isinstance(event["severity"], str) or event["severity"] not in VALID_SEVERITIES:
        raise EventContractError(f"unsupported severity: {event['severity']}")
    unknown = event.keys() - required - set(OPTIONAL_EVENT_FIELDS)
    if unknown:
        raise EventContractError(f"unsupported event fields: {', '.join(sorted(unknown))}")
    string_fields = ("username", "source_ip", "dest_ip", "process_name", "file_path", "file_hash")
    for field in string_fields:
        if event.get(field) is not None and not isinstance(event[field], str):
            raise EventContractError(f"{field} must be a string or null")
    if event.get("dest_port") is not None and (
        not isinstance(event["dest_port"], int) or isinstance(event["dest_port"], bool)
    ):
        raise EventContractError("dest_port must be an integer or null")
    if event.get("raw") is not None and not isinstance(event["raw"], dict):
        raise EventContractError("raw must be an object or null")
    return event


def build_event(
    *,
    agent_id: str,
    host: str,
    event_type: str,
    message: str,
    severity: str = "LOW",
    timestamp: datetime | str | None = None,
    event_id: str | None = None,
    **optional_fields: Any,
) -> dict[str, Any]:
    if not agent_id.strip():
        raise EventContractError("agent_id must not be empty")
    if not host.strip():
        raise EventContractError("host must not be empty")
    if not event_type.strip():
        raise EventContractError("event_type must not be empty")
    if severity.upper() not in VALID_SEVERITIES:
        raise EventContractError(f"unsupported severity: {severity}")

    normalized_id = str(uuid4()) if event_id is None else str(event_id)
    try:
        UUID(normalized_id)
    except (ValueError, AttributeError) as error:
        raise EventContractError("event_id must be a UUID") from error

    normalized_timestamp = _timestamp(timestamp)
    unknown_fields = optional_fields.keys() - OPTIONAL_EVENT_FIELDS
    if unknown_fields:
        raise EventContractError(
            f"unsupported event fields: {', '.join(sorted(unknown_fields))}"
        )

    event: dict[str, Any] = {
        "event_id": normalized_id,
        "timestamp": normalized_timestamp,
        "agent_id": agent_id,
        "host": host,
        "event_type": event_type,
        "message": message,
        "severity": severity.upper(),
    }
    event.update(
        (key, value)
        for key, value in optional_fields.items()
        if value is not None
    )
    return validate_event(event)


def _timestamp(value: datetime | str | None) -> str:
    if value is None:
        parsed = datetime.now(timezone.utc)
    elif isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (TypeError, ValueError) as error:
            raise EventContractError("timestamp must be an ISO 8601 datetime") from error

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")