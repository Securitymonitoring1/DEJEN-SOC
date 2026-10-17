import tempfile
import unittest
from pathlib import Path

from collectors.agent.collectors.process import ProcessCollector


def write_process(proc_root: Path, pid: int, name: str, start_ticks: int) -> None:
    process_dir = proc_root / str(pid)
    process_dir.mkdir()
    fields = ["S", "1"] + ["0"] * 17 + [str(start_ticks)]
    (process_dir / "stat").write_text(
        f"{pid} ({name}) " + " ".join(fields), encoding="utf-8"
    )
    (process_dir / "cmdline").write_bytes(f"{name}\0--flag\0".encode())


class ProcessCollectorTests(unittest.TestCase):
    def test_emits_normalized_process_start_once_per_process_identity(self):
        with tempfile.TemporaryDirectory() as temporary:
            proc_root = Path(temporary)
            (proc_root / "stat").write_text("btime 1000\n", encoding="ascii")
            write_process(proc_root, 123, "worker", 200)
            collector = ProcessCollector(
                agent_id="linux-test", host="host", proc_root=proc_root
            )

            events = collector.collect()

            self.assertEqual(len(events), 1)
            self.assertEqual(events[0]["event_type"], "process_start")
            self.assertEqual(events[0]["process_name"], "worker")
            self.assertEqual(events[0]["timestamp"], "1970-01-01T00:16:42Z")
            self.assertEqual(events[0]["raw"]["pid"], 123)
            self.assertEqual(events[0]["raw"]["command_line"], ["worker", "--flag"])
            self.assertEqual(collector.collect(), [])

    def test_detects_pid_reuse_as_a_new_process(self):
        with tempfile.TemporaryDirectory() as temporary:
            proc_root = Path(temporary)
            write_process(proc_root, 123, "worker", 200)
            collector = ProcessCollector(
                agent_id="linux-test", host="host", proc_root=proc_root
            )
            original_event_id = collector.collect()[0]["event_id"]
            (proc_root / "123" / "stat").write_text(
                "123 (worker) " + " ".join(["S", "1"] + ["0"] * 17 + ["300"]),
                encoding="utf-8",
            )

            events = collector.collect()

            self.assertEqual(len(events), 1)
            self.assertNotEqual(events[0]["event_id"], original_event_id)


if __name__ == "__main__":
    unittest.main()