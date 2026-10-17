import json
import logging
import os
import re
import signal
import socket
import subprocess
import threading
from collections.abc import Callable, Sequence
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from collectors.common.events import build_event


logger = logging.getLogger(__name__)
ENCODED_COMMAND = re.compile(r"(?:^|\s)-encodedcommand(?:\s|=)", re.IGNORECASE)
PROCESS_COMMAND_LINE = re.compile(r"^\s*Process Command Line:\s*(.*)$", re.IGNORECASE | re.MULTILINE)
PRIVATE_SUBJECT_FIELDS = {
    "subjectusersid",
    "subjectusername",
    "subjectdomainname",
    "subjectlogonid",
    "targetusersid",
    "targetdomainname",
    "targetlogonid",
}
PRIVATE_SUBJECT_LINES = re.compile(
    r"^\s*(?:Security ID|Account Name|Account Domain|Logon ID):[^\r\n]*(?:\r?\n)?",
    re.IGNORECASE | re.MULTILINE,
)

DEFAULT_EVENT_IDS = (4624, 4625, 4688, 4720, 4726, 4728, 4729, 4732, 4733)
WINDOWS_EVENT_TYPES = {
    4624: "authentication_success",
    4625: "authentication_failed",
    4688: "process_creation",
    4720: "user_created",
    4726: "user_deleted",
    4728: "group_membership_added",
    4729: "group_membership_removed",
    4732: "group_membership_added",
    4733: "group_membership_removed",
}


class WindowsCollectionError(RuntimeError):
    pass


class WindowsEventCollector:
    def __init__(
        self,
        *,
        agent_id: str,
        host: str | None = None,
        event_ids: Sequence[int] = DEFAULT_EVENT_IDS,
        interval_seconds: int = 10,
        timeout_seconds: float = 30,
        runner: Callable[..., Any] = subprocess.run,
    ) -> None:
        if interval_seconds < 1:
            raise ValueError("interval_seconds must be at least 1")
        if not event_ids or any(int(event_id) <= 0 for event_id in event_ids):
            raise ValueError("event_ids must contain positive Windows event IDs")
        self.agent_id = agent_id
        self.host = host or socket.gethostname()
        self.event_ids = tuple(int(event_id) for event_id in event_ids)
        self.interval_seconds = interval_seconds
        self.timeout_seconds = timeout_seconds
        self.runner = runner

    def collect(self) -> list[dict[str, Any]]:
        command = self._powershell_command()
        try:
            result = self.runner(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise WindowsCollectionError(f"Windows event log query failed: {error}") from error

        if result.returncode != 0:
            detail = (result.stderr or "PowerShell returned an error").strip()
            raise WindowsCollectionError(detail)
        if not result.stdout.strip():
            return []

        try:
            records = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise WindowsCollectionError("PowerShell returned invalid JSON") from error
        if isinstance(records, dict):
            records = [records]
        if not isinstance(records, list):
            raise WindowsCollectionError("PowerShell result must be a JSON object or array")

        events = []
        for record in records:
            try:
                event = self._normalize_record(record)
            except (TypeError, ValueError) as error:
                logger.warning("Skipping malformed Windows event record: %s", error)
                continue
            if event is not None:
                events.append(event)
        return events

    def _normalize_record(self, record: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(record, dict):
            raise TypeError("event record is not an object")
        event_id = int(record.get("EventId", 0))
        event_type = WINDOWS_EVENT_TYPES.get(event_id)
        if event_type is None:
            return None
        timestamp = record.get("TimeCreated")
        if not timestamp:
            raise ValueError("event record has no TimeCreated timestamp")
        details = record.get("EventData") or {}
        if not isinstance(details, dict):
            raise TypeError("EventData is not an object")
        username = next(
            (
                details.get(key)
                for key in ("TargetUserName", "SubjectUserName", "AccountName")
                if details.get(key) and details[key] != "-"
            ),
            None,
        )
        source_ip = details.get("IpAddress") or details.get("SourceAddress")
        if source_ip == "-":
            source_ip = None
        computer = record.get("Computer") or self.host
        message = record.get("Message") or f"Windows Security event {event_id}"
        event_data = details
        if event_type == "process_creation":
            command_line = str(details.get("CommandLine") or "").strip()
            if not command_line:
                command_match = PROCESS_COMMAND_LINE.search(message)
                command_line = command_match.group(1).strip() if command_match else ""
            if not ENCODED_COMMAND.search(command_line):
                return None
            message = f"Encoded PowerShell process creation: {command_line}"
            event_data = {
                key: value
                for key, value in details.items()
                if key.casefold() not in PRIVATE_SUBJECT_FIELDS
            }
        else:
            message = PRIVATE_SUBJECT_LINES.sub("", message).strip()
        record_id = record.get("RecordId")
        stable_id = (
            str(uuid5(NAMESPACE_URL, f"windows:{computer}:{record_id}:{event_id}:{timestamp}"))
            if record_id is not None
            else None
        )
        return build_event(
            agent_id=self.agent_id,
            host=computer,
            event_type=event_type,
            message=message,
            timestamp=timestamp,
            event_id=stable_id,
            severity="MEDIUM" if event_id == 4625 else "LOW",
            username=username,
            source_ip=source_ip,
            raw={
                "source": "windows_agent",
                "windows_event_id": event_id,
                "record_id": record.get("RecordId"),
                "provider": record.get("ProviderName"),
                "event_data": event_data,
            },
        )

    def _powershell_command(self) -> str:
        ids = ",".join(str(event_id) for event_id in self.event_ids)
        return (
            "$ErrorActionPreference = 'Stop'; "
            f"$ids = @({ids}); "
            "$start = (Get-Date).AddSeconds(-"
            f"{self.interval_seconds}); "
            "try { $records = @(Get-WinEvent -FilterHashtable @{LogName='Security'; Id=$ids; StartTime=$start} "
            "-ErrorAction Stop) } catch { "
            "if ($_.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') { throw }; $records = @() }; "
            "$records | ForEach-Object { "
            "$data = @{}; [xml]$xml = $_.ToXml(); "
            "foreach ($item in $xml.Event.EventData.Data) { $data[$item.Name] = [string]$item.'#text' }; "
            "[pscustomobject]@{ EventId=$_.Id; TimeCreated=$_.TimeCreated.ToUniversalTime().ToString('o'); "
            "Computer=$_.MachineName; RecordId=$_.RecordId; ProviderName=$_.ProviderName; "
            "Message=$_.Message; EventData=$data } } | ConvertTo-Json -Compress -Depth 6"
        )


def main() -> int:
    from dotenv import load_dotenv

    from collectors.sender.kafka import DeliveryError, KafkaEventProducer

    load_dotenv()
    interval = int(os.getenv("WINDOWS_EVENT_COLLECTION_INTERVAL", "10"))
    configured_ids = os.getenv("WINDOWS_EVENT_IDS")
    event_ids = (
        tuple(int(item.strip()) for item in configured_ids.split(",") if item.strip())
        if configured_ids
        else DEFAULT_EVENT_IDS
    )
    collector = WindowsEventCollector(
        agent_id=os.getenv("COLLECTOR_AGENT_ID", socket.gethostname()),
        host=os.getenv("COLLECTOR_HOST", socket.gethostname()),
        event_ids=event_ids,
        interval_seconds=interval,
    )
    producer = KafkaEventProducer()
    stop_event = threading.Event()
    signal.signal(signal.SIGINT, lambda *_args: stop_event.set())
    signal.signal(signal.SIGTERM, lambda *_args: stop_event.set())
    pending: list[dict[str, Any]] = []
    try:
        while not stop_event.is_set():
            try:
                pending.extend(collector.collect())
            except WindowsCollectionError:
                logger.exception("Windows event collection failed")
            while pending and not stop_event.is_set():
                try:
                    producer.send_event(pending[0])
                    pending.pop(0)
                except DeliveryError:
                    logger.exception("Windows event remains queued for delivery")
                    stop_event.wait(1)
            stop_event.wait(interval)
    finally:
        if pending:
            logger.error("Stopping with %s Windows events pending in memory", len(pending))
        producer.close()
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    raise SystemExit(main())