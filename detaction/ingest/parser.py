"""
Parses raw payloads coming from Person 1's collectors (Windows/Linux agent, syslog)
into a common intermediate dict, before normalizer.py locks it to schemas/event.json.

Different sources send slightly different shapes; this module's job is ONLY
to deal with that variance. Normalization to the final schema happens separately.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict

logger = logging.getLogger(__name__)


class ParseError(Exception):
    pass


def parse_raw_event(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Accepts a raw dict from Redpanda and returns a loosely-structured dict.
    Routes based on a 'source' field the collectors are expected to set
    (e.g. 'linux_agent', 'windows_agent', 'syslog', 'fim').
    """
    source = raw.get("source") or raw.get("collector") or "unknown"

    if source in ("linux_agent", "process_monitor"):
        return _parse_agent_event(raw)
    if source == "windows_agent":
        return _parse_windows_event(raw)
    if source == "syslog":
        return _parse_syslog_event(raw)
    if source == "fim":
        return _parse_fim_event(raw)

    logger.warning("Unknown event source '%s', passing through best-effort", source)
    return _parse_agent_event(raw)


def _parse_agent_event(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "event_id": raw.get("event_id"),
        "timestamp": raw.get("timestamp") or _now(),
        "agent_id": raw.get("agent_id"),
        "host": raw.get("host") or raw.get("hostname"),
        "event_type": raw.get("event_type"),
        "username": raw.get("username"),
        "source_ip": raw.get("source_ip") or raw.get("src_ip"),
        "dest_ip": raw.get("dest_ip"),
        "dest_port": raw.get("dest_port"),
        "process_name": raw.get("process_name") or raw.get("process"),
        "message": raw.get("message", ""),
        "raw": raw,
    }


def _parse_windows_event(raw: Dict[str, Any]) -> Dict[str, Any]:
    # Windows Event Log entries typically nest fields under EventData
    event_data = raw.get("EventData", {})
    return {
        "event_id": raw.get("event_id"),
        "timestamp": raw.get("TimeCreated") or raw.get("timestamp") or _now(),
        "agent_id": raw.get("agent_id"),
        "host": raw.get("Computer") or raw.get("host"),
        "event_type": _windows_event_type(raw.get("EventID")),
        "username": event_data.get("TargetUserName") or raw.get("username"),
        "source_ip": event_data.get("IpAddress") or raw.get("source_ip"),
        "message": raw.get("Message", ""),
        "raw": raw,
    }


def _parse_syslog_event(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "event_id": raw.get("event_id"),
        "timestamp": raw.get("timestamp") or _now(),
        "agent_id": raw.get("agent_id", "syslog"),
        "host": raw.get("host"),
        "event_type": raw.get("event_type", "syslog_message"),
        "username": raw.get("username"),
        "source_ip": raw.get("source_ip"),
        "message": raw.get("message", raw.get("msg", "")),
        "raw": raw,
    }


def _parse_fim_event(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "event_id": raw.get("event_id"),
        "timestamp": raw.get("timestamp") or _now(),
        "agent_id": raw.get("agent_id"),
        "host": raw.get("host"),
        "event_type": "file_modified",
        "file_path": raw.get("file_path"),
        "file_hash": raw.get("sha256"),
        "message": raw.get("message", f"File changed: {raw.get('file_path')}"),
        "raw": raw,
    }


def _windows_event_type(event_id) -> str:
    mapping = {
        4624: "authentication_success",
        4625: "authentication_failed",
        4688: "process_start",
        4720: "user_created",
    }
    return mapping.get(int(event_id), "windows_event") if event_id else "windows_event"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
