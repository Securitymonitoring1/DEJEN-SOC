import json
import os
import platform
import queue
import socket
import subprocess
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


VERSION = "1.0.0"
HEARTBEAT_SECONDS = 5
COLLECTION_SECONDS = 1
EVENT_LOOKBACK_SECONDS = 5


def config_path() -> Path:
    if os.name == "nt":
        base = Path(os.getenv("LOCALAPPDATA", Path.home() / "AppData/Local"))
        return base / "Dejen" / "agent.json"
    return Path.home() / ".config" / "dejen-agent" / "agent.json"


def save_config(config: dict, path: Path | None = None) -> Path:
    destination = path or config_path()
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != "nt":
        try:
            destination.parent.chmod(0o700)
        except OSError:
            pass
    destination.write_text(json.dumps(config, indent=2), encoding="utf-8")
    try:
        destination.chmod(0o600)
    except OSError:
        pass
    if os.name == "nt":
        username = os.getenv("USERNAME")
        if username:
            subprocess.run(
                [
                    "icacls.exe",
                    str(destination),
                    "/inheritance:r",
                    "/grant:r",
                    f"{username}:(R,W)",
                    "NT AUTHORITY\\SYSTEM:(R)",
                ],
                capture_output=True,
                check=False,
            )
    return destination


def load_config(path: Path | None = None) -> dict:
    source = path or config_path()
    if not source.exists():
        return {}
    return json.loads(source.read_text(encoding="utf-8"))


def backend_url(server: str, port: str | int) -> str:
    host = server.strip().rstrip("/")
    if not host.startswith(("http://", "https://")):
        host = f"http://{host}"
    if "://" in host and host.rsplit(":", 1)[-1].isdigit():
        return host
    return f"{host}:{int(port)}"


def local_ip_for_server(api_url: str) -> str | None:
    try:
        parsed = urlsplit(api_url)
        if not parsed.hostname:
            return None
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        destinations = socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_DGRAM)
        for family, socket_type, protocol, _, address in destinations:
            try:
                with socket.socket(family, socket_type, protocol) as probe:
                    probe.connect(address)
                    local_ip = probe.getsockname()[0]
                if local_ip not in {"0.0.0.0", "::", "127.0.0.1", "::1"}:
                    return local_ip
            except OSError:
                continue
    except (OSError, ValueError):
        return None
    return None


def request_json(
    url: str,
    payload: dict | None = None,
    api_key: str | None = None,
    *,
    method: str | None = None,
) -> dict:
    headers = {"Accept": "application/json"}
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = Request(url, data=body, headers=headers, method=method or ("POST" if body else "GET"))
    with urlopen(request, timeout=8) as response:
        if response.status == 204:
            return {}
        return json.loads(response.read().decode("utf-8"))


class AgentRuntime:
    def __init__(self, config: dict, messages: queue.Queue | None = None):
        self.config = config
        self.messages = messages or queue.Queue()
        self.stop_event = threading.Event()
        self.events_sent = 0
        self.last_event_sent = "-"
        self._seen_windows_events: set[str] = set()

    def log(self, message: str, state: str | None = None) -> None:
        self.messages.put({"message": message, "state": state})

    def stop(self) -> None:
        self.stop_event.set()

    def run(self) -> None:
        if not self.config.get("api_key") or not self.config.get("agent_id"):
            self.log("Agent is not enrolled. Register it in the manager first.", "Disconnected")
            return
        api_base = self.config["api_url"].rstrip("/")
        self.log(f"Agent worker started for {self.config.get('name', socket.gethostname())}", "Disconnected")
        next_heartbeat = 0.0
        next_action_poll = 0.0
        linux_reader = None
        linux_process_collector = None
        if platform.system() == "Linux":
            from agent.authlog import parse_auth_line
            from agent.config import AgentConfig
            from agent.log_reader import LogReader
            from collectors.agent.collectors.process import ProcessCollector

            linux_config = AgentConfig(
                api_url=api_base,
                api_token=self.config["api_key"],
                agent_id=str(self.config["agent_id"]),
                host=socket.gethostname(),
                auth_log_path=self.config.get("auth_log_path", "/var/log/auth.log"),
                poll_interval=COLLECTION_SECONDS,
            )
            linux_reader = (LogReader(linux_config.auth_log_path), parse_auth_line, linux_config)
            linux_reader[0].start_at_end()
            linux_process_collector = ProcessCollector(
                agent_id=str(self.config["agent_id"]),
                host=socket.gethostname(),
            )

        fim_monitor = None
        fim_paths = self.config.get("fim_paths", [])
        if isinstance(fim_paths, str):
            fim_paths = [path.strip() for path in fim_paths.split(",") if path.strip()]
        if fim_paths:
            try:
                from collectors.fim.monitor import FIMMonitor

                config_file = Path(self.config.get("_config_path") or config_path())
                baseline_path = self.config.get("fim_baseline_path") or str(
                    config_file.with_name("fim_baseline.json")
                )
                fim_monitor = FIMMonitor(
                    fim_paths,
                    baseline_path,
                    agent_id=str(self.config["agent_id"]),
                    host=socket.gethostname(),
                )
                if not fim_monitor.store.exists:
                    fim_monitor.initialize_baseline()
                self.log(f"FIM monitoring {len(fim_paths)} configured path(s)")
            except Exception as error:
                self.log(f"FIM collector failed to initialize: {error}")
                fim_monitor = None

        pending_events: list[dict] = []
        while not self.stop_event.is_set():
            now = time.monotonic()
            if now >= next_heartbeat:
                try:
                    request_json(
                        f"{api_base}/agents/heartbeat",
                        {
                            "version": VERSION,
                            "host": socket.gethostname(),
                            "ip_address": local_ip_for_server(api_base),
                        },
                        self.config["api_key"],
                    )
                    self.log("Heartbeat accepted by manager", "Connected")
                except (HTTPError, URLError, OSError, ValueError) as error:
                    self.log(f"Heartbeat failed: {error}", "Disconnected")
                next_heartbeat = now + HEARTBEAT_SECONDS

            if now >= next_action_poll:
                self._poll_response_actions(api_base)
                next_action_poll = now + HEARTBEAT_SECONDS

            try:
                if platform.system() == "Windows":
                    events = self._collect_windows()
                elif platform.system() == "Linux":
                    events = self._collect_linux(linux_reader)
                else:
                    raise RuntimeError(f"Unsupported operating system: {platform.system()}")
                if linux_process_collector is not None:
                    try:
                        events.extend(linux_process_collector.collect())
                    except Exception as error:
                        self.log(f"Process collector failed: {error}")
                if fim_monitor is not None:
                    try:
                        events.extend(fim_monitor.scan_once())
                    except Exception as error:
                        self.log(f"FIM collection failed: {error}")
                pending_events.extend(events)
                for event in list(pending_events):
                    if self.stop_event.is_set():
                        break
                    event["agent_id"] = str(self.config["agent_id"])
                    try:
                        request_json(f"{api_base}/agents/events", event, self.config["api_key"])
                        pending_events.remove(event)
                        self.events_sent += 1
                        self.last_event_sent = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
                        self.log(f"Event sent: {event.get('event_type')} | {event.get('message', '')[:180]}", "Connected")
                        self.messages.put({"events_sent": self.events_sent, "last_event_sent": self.last_event_sent})
                    except (HTTPError, URLError, OSError, ValueError) as error:
                        self.log(f"Event delivery failed: {error}", "Disconnected")
                        break
            except Exception as error:
                self.log(f"Collection failed: {error}")
            self.stop_event.wait(COLLECTION_SECONDS)
        self.log("Agent worker stopped", "Disconnected")

    def _poll_response_actions(self, api_base: str) -> None:
        try:
            actions = request_json(
                f"{api_base}/agents/actions",
                api_key=self.config["api_key"],
            )
        except (HTTPError, URLError, OSError, ValueError) as error:
            self.log(f"Response-action poll failed: {error}", "Disconnected")
            return

        if not isinstance(actions, list):
            self.log("Manager returned an invalid response-action list")
            return

        from dejen_agent.response import ActionReceiptStore, execute_endpoint_action

        config_file = Path(self.config.get("_config_path") or config_path())
        try:
            receipts = ActionReceiptStore(config_file.with_name("action_receipts.json"))
        except Exception as error:
            self.log(f"Could not load response action receipts: {error}")
            return

        for action in actions:
            action_id = action.get("action_id")
            running_result = None
            if action.get("action_type") == "ISOLATE_ENDPOINT":
                running_result = (
                    "Disabling network adapters; this endpoint may stop checking in "
                    "until network access is restored locally."
                )
            try:
                request_json(
                    f"{api_base}/agents/actions/{action_id}",
                    {"status": "RUNNING", "result": running_result},
                    self.config["api_key"],
                    method="PATCH",
                )
            except (HTTPError, URLError, OSError, ValueError) as error:
                self.log(f"Could not claim response action {action_id}: {error}", "Disconnected")
                return

            receipt = receipts.get(str(action_id))
            if receipt is None:
                try:
                    stop_agent = execute_endpoint_action(action, state_dir=config_file.parent)
                    receipt = {
                        "status": "SUCCEEDED",
                        "result": f"{action['action_type']} applied",
                        "stop_agent": stop_agent,
                    }
                    receipts.save(str(action_id), receipt)
                except Exception as error:
                    try:
                        request_json(
                            f"{api_base}/agents/actions/{action_id}",
                            {"status": "FAILED", "result": str(error)},
                            self.config["api_key"],
                            method="PATCH",
                        )
                    except (HTTPError, URLError, OSError, ValueError):
                        self.log(f"Could not report failed response action {action_id}")
                    self.log(f"Response action failed: {error}")
                    continue
            else:
                stop_agent = bool(receipt.get("stop_agent"))

            try:
                request_json(
                    f"{api_base}/agents/actions/{action_id}",
                    {"status": receipt["status"], "result": receipt["result"]},
                    self.config["api_key"],
                    method="PATCH",
                )
            except (HTTPError, URLError, OSError, ValueError) as error:
                self.log(f"Response action applied but acknowledgement failed: {error}", "Disconnected")
                continue

            self.log(f"Response action completed: {action['action_type']}", "Connected")
            receipts.remove(str(action_id))
            if stop_agent:
                self.stop()
                return

    def _collect_windows(self) -> list[dict]:
        from collectors.agent.collectors.windows import WindowsEventCollector

        collector = WindowsEventCollector(
            agent_id=str(self.config["agent_id"]),
            interval_seconds=EVENT_LOOKBACK_SECONDS,
            timeout_seconds=5,
        )
        results = []
        for event in collector.collect():
            event_key = event.get("event_id")
            if event_key and event_key in self._seen_windows_events:
                continue
            if event_key:
                self._seen_windows_events.add(event_key)
            results.append(event)
        return results

    @staticmethod
    def _collect_linux(reader_info) -> list[dict]:
        reader, parser, config = reader_info
        events = []
        for line in reader.read_new_lines():
            event = parser(line, agent_id=config.agent_id, host=config.host)
            if event:
                events.append(event)
        return events