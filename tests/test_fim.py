import hashlib
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from collectors.fim.baseline import BaselineError, BaselineStore
from collectors.fim.main import _create_event_delivery
from collectors.fim.monitor import FIMMonitor


class FIMTests(unittest.TestCase):
    def test_http_delivery_uses_dejen_events_api(self):
        with patch.dict(
            os.environ,
            {
                "FIM_DELIVERY": "http",
                "DEJEN_API_URL": "http://platform.test",
                "DEJEN_API_TOKEN": "test-token",
            },
        ), patch("agent.client.send_event") as send_event:
            deliver, close = _create_event_delivery()
            event = {"event_type": "file_modified"}

            deliver(event)
            close()

        send_event.assert_called_once_with(event, "http://platform.test", "test-token")

    def test_baseline_round_trip_is_owner_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = BaselineStore(Path(temporary) / "data" / "baseline.json")
            entry = {"/tmp/a": {"sha256": "abc", "size": 3, "mtime_ns": 1}}
            store.save(entry)
            self.assertEqual(store.load(), entry)
            self.assertEqual(store.path.stat().st_mode & 0o777, 0o600)

    def test_baseline_rejects_corrupt_json(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "baseline.json"
            path.write_text("not-json", encoding="utf-8")
            with self.assertRaises(BaselineError):
                BaselineStore(path).load()

    def test_detects_create_modify_rename_delete_and_hash(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "watch"
            root.mkdir()
            baseline_path = Path(temporary) / "baseline.json"
            monitor = FIMMonitor([root], baseline_path, agent_id="fim-test")
            monitor.initialize_baseline()

            created = root / "created.txt"
            created.write_text("one", encoding="utf-8")
            event = monitor.scan_once()[0]
            self.assertEqual(event["event_type"], "file_created")
            self.assertEqual(event["file_hash"], hashlib.sha256(b"one").hexdigest())

            created.write_text("two", encoding="utf-8")
            self.assertEqual(monitor.scan_once()[0]["event_type"], "file_modified")

            renamed = root / "renamed.txt"
            created.rename(renamed)
            rename_event = monitor.scan_once()[0]
            self.assertEqual(rename_event["event_type"], "file_renamed")
            self.assertEqual(rename_event["raw"]["previous_file_path"], str(created))

            renamed.unlink()
            self.assertEqual(monitor.scan_once()[0]["event_type"], "file_deleted")

    def test_exclusions_and_unchanged_files_do_not_emit_duplicates(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "watch"
            root.mkdir()
            ignored = root / "cache.tmp"
            ignored.write_text("ignored", encoding="utf-8")
            tracked = root / "tracked.txt"
            tracked.write_text("same", encoding="utf-8")
            monitor = FIMMonitor(
                [root],
                Path(temporary) / "baseline.json",
                exclusions=("*.tmp",),
            )
            baseline = monitor.initialize_baseline()
            self.assertEqual(list(baseline), [str(tracked)])
            self.assertEqual(monitor.scan_once(), [])

    def test_watchdog_triggers_a_scan_for_new_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "watch"
            root.mkdir()
            delivered = threading.Event()
            observed = []

            def on_event(event):
                observed.append(event)
                delivered.set()

            monitor = FIMMonitor(
                [root],
                Path(temporary) / "baseline.json",
                on_event=on_event,
                interval_seconds=0.1,
            )
            monitor.initialize_baseline()
            stop_event = threading.Event()
            worker = threading.Thread(target=monitor.run, args=(stop_event,))
            worker.start()
            try:
                (root / "new.txt").write_text("change", encoding="utf-8")
                self.assertTrue(delivered.wait(3))
                self.assertEqual(observed[0]["event_type"], "file_created")
            finally:
                stop_event.set()
                worker.join(timeout=3)
            self.assertFalse(worker.is_alive())


if __name__ == "__main__":
    unittest.main()