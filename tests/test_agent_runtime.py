import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from collectors.fim.monitor import FIMMonitor
from dejen_agent.runtime import AgentRuntime


class AgentRuntimeTests(unittest.TestCase):
    def test_sends_configured_fim_changes_to_agent_api(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "watch"
            root.mkdir()
            watched_file = root / "watched.txt"
            watched_file.write_text("baseline", encoding="utf-8")
            baseline_path = Path(temporary) / "baseline.json"
            FIMMonitor([root], baseline_path).initialize_baseline()
            watched_file.write_text("modified", encoding="utf-8")

            runtime = AgentRuntime(
                {
                    "api_key": "test-key",
                    "agent_id": "test-agent",
                    "api_url": "http://platform.test",
                    "fim_paths": [str(root)],
                    "fim_baseline_path": str(baseline_path),
                }
            )
            requests = []

            def request_json(url, payload=None, api_key=None):
                requests.append((url, payload, api_key))
                if url.endswith("/agents/events"):
                    runtime.stop()
                return {}

            with (
                patch("dejen_agent.runtime.platform.system", return_value="Windows"),
                patch("dejen_agent.runtime.request_json", side_effect=request_json),
                patch.object(runtime, "_collect_windows", return_value=[]),
            ):
                runtime.run()

            submitted = [request for request in requests if request[0].endswith("/agents/events")]
            self.assertEqual(len(submitted), 1)
            self.assertEqual(submitted[0][1]["event_type"], "file_modified")
            self.assertEqual(submitted[0][2], "test-key")


if __name__ == "__main__":
    unittest.main()
