"""
Converts loosely-parsed events into the strict shared schema (schemas/event.json).
This is the contract the rest of the team (and OpenSearch) relies on.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

VALID_SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

# Default severities per event_type, used when the collector doesn't set one.
# Detection rules can still re-score/override this later.
DEFAULT_SEVERITY_BY_TYPE = {
    "authentication_failed": "LOW",
    "authentication_success": "LOW",
    "process_start": "LOW",
    "file_modified": "MEDIUM",
    "port_scan_detected": "MEDIUM",
    "malware_detected": "CRITICAL",
}


class NormalizationError(Exception):
    pass


def normalize_event(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Takes a parser.py output dict and returns a dict that strictly matches
    schemas/event.json. Raises NormalizationError if required fields are
    unrecoverably missing.
    """
    event_id = parsed.get("event_id") or str(uuid.uuid4())
    timestamp = _normalize_timestamp(parsed.get("timestamp"))
    agent_id = parsed.get("agent_id")
    host = parsed.get("host")
    event_type = parsed.get("event_type")
    message = parsed.get("message", "")

    if not host:
        raise NormalizationError(f"event {event_id} missing required field 'host'")
    if not event_type:
        raise NormalizationError(f"event {event_id} missing required field 'event_type'")

    severity = _normalize_severity(parsed.get("severity"), event_type)

    normalized = {
        "event_id": event_id,
        "timestamp": timestamp,
        "agent_id": agent_id or "unknown",
        "host": host,
        "event_type": event_type,
        "username": parsed.get("username"),
        "source_ip": parsed.get("source_ip"),
        "dest_ip": parsed.get("dest_ip"),
        "dest_port": parsed.get("dest_port"),
        "process_name": parsed.get("process_name"),
        "file_path": parsed.get("file_path"),
        "file_hash": parsed.get("file_hash"),
        "message": message,
        "severity": severity,
        "raw": parsed.get("raw"),
    }
    return normalized


def _normalize_timestamp(ts: Optional[str]) -> str:
    if not ts:
        return datetime.now(timezone.utc).isoformat()
    try:
        # accept both with/without timezone, normalize to isoformat
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


def _normalize_severity(severity: Optional[str], event_type: str) -> str:
    if severity and severity.upper() in VALID_SEVERITIES:
        return severity.upper()
    return DEFAULT_SEVERITY_BY_TYPE.get(event_type, "LOW")
