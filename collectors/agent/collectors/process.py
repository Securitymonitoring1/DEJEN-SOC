import logging
import os
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from collectors.common.events import build_event


logger = logging.getLogger(__name__)


class ProcessCollectionError(RuntimeError):
    pass


class ProcessCollector:
    def __init__(
        self,
        *,
        agent_id: str,
        host: str | None = None,
        proc_root: str | Path = "/proc",
    ) -> None:
        self.agent_id = agent_id
        self.host = host or socket.gethostname()
        self.proc_root = Path(proc_root)
        self._seen: set[tuple[int, int]] = set()
        self._clock_ticks = os.sysconf("SC_CLK_TCK")

    def collect(self) -> list[dict[str, Any]]:
        try:
            entries = list(self.proc_root.iterdir())
        except OSError as error:
            raise ProcessCollectionError(f"Cannot read process table {self.proc_root}: {error}") from error

        events = []
        current: set[tuple[int, int]] = set()
        boot_time = self._read_boot_time()
        for entry in entries:
            if not entry.name.isdecimal():
                continue
            try:
                event, identity = self._read_process(entry, boot_time)
            except (OSError, ValueError, IndexError) as error:
                logger.debug("Skipping process entry %s: %s", entry, error)
                continue
            current.add(identity)
            if identity not in self._seen:
                events.append(event)

        self._seen = current
        return events

    def _read_boot_time(self) -> float | None:
        try:
            for line in (self.proc_root / "stat").read_text(encoding="ascii").splitlines():
                if line.startswith("btime "):
                    return float(line.split()[1])
        except (OSError, ValueError, IndexError):
            return None
        return None

    def _read_process(
        self, entry: Path, boot_time: float | None
    ) -> tuple[dict[str, Any], tuple[int, int]]:
        pid = int(entry.name)
        stat = (entry / "stat").read_text(encoding="utf-8")
        closing_paren = stat.rfind(")")
        fields = stat[closing_paren + 2 :].split()
        process_name = stat[stat.find("(") + 1 : closing_paren]
        parent_pid = int(fields[1])
        start_ticks = int(fields[19])
        identity = (pid, start_ticks)
        start_epoch = boot_time + start_ticks / self._clock_ticks if boot_time is not None else None
        timestamp = (
            datetime.fromtimestamp(start_epoch, timezone.utc)
            if start_epoch is not None
            else None
        )
        command_line = (entry / "cmdline").read_bytes().split(b"\0")
        command_line_text = [part.decode("utf-8", errors="replace") for part in command_line if part]
        try:
            executable = str((entry / "exe").resolve())
        except OSError:
            executable = None

        event_id = str(uuid5(NAMESPACE_URL, f"process:{self.host}:{pid}:{start_ticks}"))
        event = build_event(
            agent_id=self.agent_id,
            host=self.host,
            event_type="process_start",
            message=f"Process started: {process_name} (pid {pid})",
            timestamp=timestamp,
            event_id=event_id,
            process_name=process_name,
            raw={
                "source": "process_monitor",
                "pid": pid,
                "parent_pid": parent_pid,
                "executable": executable,
                "command_line": command_line_text,
            },
        )
        return event, identity