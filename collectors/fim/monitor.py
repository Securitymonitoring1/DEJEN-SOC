import fnmatch
import hashlib
import logging
import os
import socket
import stat
import threading
from collections import defaultdict
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from collectors.common.events import build_event
from collectors.fim.baseline import BaselineStore


logger = logging.getLogger(__name__)
HASH_CHUNK_SIZE = 1024 * 1024


class FIMMonitor:
    def __init__(
        self,
        paths: Sequence[str | Path],
        baseline_path: str | Path,
        *,
        on_event: Callable[[dict[str, Any]], None] | None = None,
        agent_id: str | None = None,
        host: str | None = None,
        exclusions: Sequence[str] = (),
        interval_seconds: float = 5,
    ) -> None:
        if not paths:
            raise ValueError("at least one monitored path is required")
        if interval_seconds <= 0:
            raise ValueError("interval_seconds must be positive")
        self.paths = tuple(Path(path).expanduser().resolve() for path in paths)
        self.store = BaselineStore(baseline_path)
        self.on_event = on_event
        self.agent_id = agent_id or socket.gethostname()
        self.host = host or socket.gethostname()
        self.exclusions = tuple(exclusions)
        self.interval_seconds = interval_seconds

    def initialize_baseline(self) -> dict[str, dict[str, Any]]:
        snapshot, _ = self._snapshot({})
        self.store.save(snapshot)
        return snapshot

    def scan_once(self) -> list[dict[str, Any]]:
        previous = self.store.load()
        current, inaccessible = self._snapshot(previous)
        for root in inaccessible:
            for old_path, old_entry in previous.items():
                if old_path == root or old_path.startswith(root + os.sep):
                    current.setdefault(old_path, old_entry)

        events = self._diff(previous, current)
        if self.on_event is not None:
            for event in events:
                self.on_event(event)
        self.store.save(current)
        return events

    def run(self, stop_event: threading.Event) -> None:
        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer
        except ImportError as error:
            raise RuntimeError("Install watchdog to run continuous FIM monitoring") from error

        if not self.store.exists:
            self.initialize_baseline()

        changed = threading.Event()

        class ChangeHandler(FileSystemEventHandler):
            def on_any_event(self, event) -> None:
                if not event.is_directory:
                    changed.set()

        observer = Observer()
        handler = ChangeHandler()
        watched = set()
        for path in self.paths:
            watch_path = path if path.is_dir() else path.parent
            if watch_path.exists() and str(watch_path) not in watched:
                observer.schedule(handler, str(watch_path), recursive=watch_path.is_dir())
                watched.add(str(watch_path))
        if not watched:
            raise FileNotFoundError("none of the configured FIM paths can be watched")

        observer.start()
        try:
            while not stop_event.is_set():
                changed.wait(self.interval_seconds)
                changed.clear()
                if stop_event.is_set():
                    break
                try:
                    self.scan_once()
                except Exception:
                    logger.exception("FIM scan failed; leaving the previous baseline intact")
        finally:
            observer.stop()
            observer.join(timeout=10)

    def _snapshot(
        self,
        previous: dict[str, dict[str, Any]],
    ) -> tuple[dict[str, dict[str, Any]], set[str]]:
        snapshot: dict[str, dict[str, Any]] = {}
        inaccessible: set[str] = set()

        def walk_error(error: OSError) -> None:
            inaccessible.add(str(Path(error.filename or "").resolve()))
            logger.warning("Cannot access FIM path %s: %s", error.filename, error)

        for root in self.paths:
            if self._is_excluded(root):
                continue
            try:
                root_stat = root.lstat()
            except FileNotFoundError:
                continue
            except OSError as error:
                inaccessible.add(str(root))
                logger.warning("Cannot access FIM root %s: %s", root, error)
                continue
            if stat.S_ISREG(root_stat.st_mode):
                self._add_file(root, snapshot, inaccessible)
            elif stat.S_ISDIR(root_stat.st_mode):
                for directory, dirnames, filenames in os.walk(root, onerror=walk_error):
                    dirnames[:] = [
                        name
                        for name in dirnames
                        if not self._is_excluded(Path(directory) / name)
                    ]
                    for filename in filenames:
                        path = Path(directory) / filename
                        if not self._is_excluded(path):
                            self._add_file(path, snapshot, inaccessible)
            else:
                logger.warning("Skipping non-regular FIM path %s", root)

        for old_path in previous:
            if any(old_path == root or old_path.startswith(root + os.sep) for root in inaccessible):
                snapshot.setdefault(old_path, previous[old_path])
        return snapshot, inaccessible

    def _add_file(
        self,
        path: Path,
        snapshot: dict[str, dict[str, Any]],
        inaccessible: set[str],
    ) -> None:
        try:
            metadata = path.stat(follow_symlinks=False)
            if not stat.S_ISREG(metadata.st_mode):
                return
            digest = hashlib.sha256()
            with path.open("rb") as source:
                for chunk in iter(lambda: source.read(HASH_CHUNK_SIZE), b""):
                    digest.update(chunk)
            snapshot[str(path)] = {
                "sha256": digest.hexdigest(),
                "size": metadata.st_size,
                "mtime_ns": metadata.st_mtime_ns,
            }
        except OSError as error:
            inaccessible.add(str(path))
            logger.warning("Cannot hash FIM file %s: %s", path, error)

    def _is_excluded(self, path: Path) -> bool:
        value = str(path)
        return any(
            fnmatch.fnmatch(value, pattern)
            or fnmatch.fnmatch(path.name, pattern)
            for pattern in self.exclusions
        )

    def _diff(
        self,
        previous: dict[str, dict[str, Any]],
        current: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        deleted_paths = set(previous) - set(current)
        created_paths = set(current) - set(previous)
        deleted_by_hash: dict[str, list[str]] = defaultdict(list)
        created_by_hash: dict[str, list[str]] = defaultdict(list)
        for path in deleted_paths:
            deleted_by_hash[previous[path]["sha256"]].append(path)
        for path in created_paths:
            created_by_hash[current[path]["sha256"]].append(path)

        events = []
        renamed_old: set[str] = set()
        renamed_new: set[str] = set()
        for digest in deleted_by_hash.keys() & created_by_hash.keys():
            old_paths = deleted_by_hash[digest]
            new_paths = created_by_hash[digest]
            if len(old_paths) == len(new_paths) == 1:
                old_path, new_path = old_paths[0], new_paths[0]
                renamed_old.add(old_path)
                renamed_new.add(new_path)
                events.append(
                    self._event(
                        "file_renamed",
                        new_path,
                        digest,
                        {"change_type": "renamed", "previous_file_path": old_path},
                    )
                )

        for path in sorted(created_paths - renamed_new):
            events.append(
                self._event("file_created", path, current[path]["sha256"], {"change_type": "created"})
            )
        for path in sorted(deleted_paths - renamed_old):
            events.append(
                self._event("file_deleted", path, previous[path]["sha256"], {"change_type": "deleted"})
            )
        for path in sorted(set(previous) & set(current)):
            old_entry, new_entry = previous[path], current[path]
            if old_entry != new_entry:
                events.append(
                    self._event(
                        "file_modified",
                        path,
                        new_entry["sha256"],
                        {"change_type": "modified", "previous_sha256": old_entry["sha256"]},
                    )
                )
        return events

    def _event(
        self,
        event_type: str,
        path: str,
        file_hash: str,
        details: dict[str, str],
    ) -> dict[str, Any]:
        return build_event(
            agent_id=self.agent_id,
            host=self.host,
            event_type=event_type,
            message=f"FIM detected {details['change_type']}: {path}",
            severity="MEDIUM",
            file_path=path,
            file_hash=file_hash,
            raw={"source": "fim", **details},
        )