import json
import subprocess
from datetime import datetime, timezone
from typing import Any

from agent.authlog import parse_auth_line


def parse_macos_log_records(
    records: Any, *, agent_id: str, host: str
) -> list[dict[str, Any]]:
    if isinstance(records, dict):
        records = [records]
    if not isinstance(records, list):
        raise ValueError("macOS unified log output must be an object or array")

    events = []
    for record in records:
        if not isinstance(record, dict):
            continue
        message = record.get("eventMessage") or record.get("message")
        if not isinstance(message, str):
            continue
        event = parse_auth_line(message, agent_id=agent_id, host=host)
        if event is None:
            continue
        timestamp = record.get("timestamp")
        if isinstance(timestamp, str):
            try:
                parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                pass
            else:
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                event["timestamp"] = parsed.isoformat()
        events.append(event)
    return events


def collect_macos_auth_events(
    *, agent_id: str, host: str, lookback_seconds: int = 10
) -> list[dict[str, Any]]:
    result = subprocess.run(
        [
            "/usr/bin/log",
            "show",
            "--style",
            "json",
            "--last",
            f"{lookback_seconds}s",
            "--info",
            "--predicate",
            'process == "sshd"',
        ],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or "macOS unified log query failed").strip())
    if not result.stdout.strip():
        return []
    try:
        records = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError("macOS unified log returned invalid JSON") from error
    return parse_macos_log_records(records, agent_id=agent_id, host=host)