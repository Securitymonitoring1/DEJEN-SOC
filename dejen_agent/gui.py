import argparse
import os
import platform
import queue
import socket
import threading
import time
import tkinter as tk
from queue import Empty
from pathlib import Path
from tkinter import messagebox, ttk
from urllib.error import HTTPError, URLError

from dejen_agent import __version__
from dejen_agent.runtime import AgentRuntime, backend_url, config_path, load_config, local_ip_for_server, request_json, save_config


class AgentManager:
    def __init__(self, root: tk.Tk, arguments: argparse.Namespace):
        self.root = root
        self.root.title("Dejen Agent Manager")
        self.root.geometry("680x620")
        self.root.minsize(560, 500)
        self.messages: queue.Queue = queue.Queue()
        self.runtime: AgentRuntime | None = None
        self.worker: threading.Thread | None = None
        self.config = load_config()
        self.status = tk.StringVar(value="Disconnected")
        self.last_sent = tk.StringVar(value="-")
        self.event_count = tk.StringVar(value="0")

        branding = ttk.Frame(root, padding=(18, 12, 18, 8))
        branding.pack(fill="x")
        self.brand_images = []
        asset_dirs = (
            Path(__file__).resolve().parent / "assets",
            Path(__file__).resolve().parents[1] / "Frontend" / "src" / "assets" / "images",
        )
        asset_dir = next((path for path in asset_dirs if path.is_dir()), None)
        if asset_dir:
            for filename, factor in (
                ("DEJEN SOC Ethiopian Cyber Shield1.png", 8),
                ("DEJEN SOC Ethiopian Cyber Shield2.png", 4),
            ):
                image_path = asset_dir / filename
                if not image_path.is_file():
                    continue
                try:
                    original = tk.PhotoImage(file=str(image_path))
                    display = original.subsample(factor, factor)
                except tk.TclError:
                    continue
                self.brand_images.extend((original, display))
                ttk.Label(branding, image=display).pack(side="left", padx=(0, 12))
        ttk.Label(branding, text="ENDPOINT AGENT", font=("TkDefaultFont", 10, "bold")).pack(side="left")
        fields = ttk.Frame(root, padding=(18, 0, 18, 8))
        fields.pack(fill="x")
        self.server = self._field(fields, "Manager / server", self.config.get("server", ""), 0)
        self.port = self._field(fields, "Port", str(self.config.get("port", 8000)), 1)
        self.name = self._field(fields, "Agent name", self.config.get("name", socket.gethostname()), 2)
        self.token = self._field(fields, "Enrollment token", "", 3, show="*")
        fim_paths = self.config.get("fim_paths", [])
        self.fim_paths = self._field(
            fields,
            "FIM paths (comma-separated)",
            ",".join(fim_paths) if isinstance(fim_paths, list) else str(fim_paths),
            4,
        )

        buttons = ttk.Frame(root, padding=(18, 0, 18, 12))
        buttons.pack(fill="x")
        for label, action in (("Test connection", self.test_connection), ("Register agent", self.register), ("Save", self.save)):
            ttk.Button(buttons, text=label, command=action).pack(side="left", padx=(0, 7))
        self.start_button = ttk.Button(buttons, text="Start", command=self.start)
        self.start_button.pack(side="left", padx=(0, 7))
        self.stop_button = ttk.Button(buttons, text="Stop", command=self.stop, state="disabled")
        self.stop_button.pack(side="left")

        status_panel = ttk.LabelFrame(root, text="Agent status", padding=12)
        status_panel.pack(fill="x", padx=18, pady=(0, 12))
        for label, variable in (("Connection", self.status), ("Last event sent", self.last_sent), ("Events sent", self.event_count)):
            row = ttk.Frame(status_panel)
            row.pack(fill="x", pady=2)
            ttk.Label(row, text=label, width=18).pack(side="left")
            ttk.Label(row, textvariable=variable).pack(side="left")

        log_panel = ttk.LabelFrame(root, text="Live log", padding=8)
        log_panel.pack(fill="both", expand=True, padx=18, pady=(0, 14))
        self.log_view = tk.Text(log_panel, height=12, wrap="word", state="disabled", font=("TkFixedFont", 9))
        scrollbar = ttk.Scrollbar(log_panel, command=self.log_view.yview)
        self.log_view.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        self.log_view.pack(side="left", fill="both", expand=True)

        if self.config.get("api_key"):
            self.status.set("Registered")
            self._append_log(f"Saved agent configuration: {config_path()}")
        if arguments.server:
            self.server.delete(0, tk.END)
            self.server.insert(0, arguments.server)
        if arguments.name:
            self.name.delete(0, tk.END)
            self.name.insert(0, arguments.name)
        if arguments.token:
            self.token.insert(0, arguments.token)
        if arguments.enroll:
            self.root.after(350, self.register)
        self.root.after(150, self._drain_messages)
        self.root.protocol("WM_DELETE_WINDOW", self.close)

    @staticmethod
    def _field(parent, label, value, row, show=None):
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=4)
        entry = ttk.Entry(parent, show=show)
        entry.insert(0, value)
        entry.grid(row=row, column=1, sticky="ew", padx=(12, 0), pady=4)
        parent.columnconfigure(1, weight=1)
        return entry

    def _values(self) -> dict:
        server = self.server.get().strip()
        port = self.port.get().strip()
        if not server:
            raise ValueError("Enter the manager/server address.")
        if not port.isdigit() or not 1 <= int(port) <= 65535:
            raise ValueError("Port must be an integer from 1 to 65535.")
        return {
            **self.config,
            "server": server,
            "port": int(port),
            "api_url": backend_url(server, port),
            "name": self.name.get().strip() or socket.gethostname(),
            "host": socket.gethostname(),
            "version": __version__,
            "auth_log_path": self.config.get("auth_log_path", "/var/log/auth.log"),
            "fim_paths": [path.strip() for path in self.fim_paths.get().split(",") if path.strip()],
        }

    def save(self) -> None:
        try:
            self.config = self._values()
            saved_path = save_config(self.config)
            self._append_log(f"Configuration saved with restricted permissions: {saved_path}")
            messagebox.showinfo("Saved", f"Configuration saved to:\n{saved_path}")
        except (OSError, ValueError) as error:
            messagebox.showerror("Save failed", str(error))

    def test_connection(self) -> None:
        try:
            values = self._values()
            result = request_json(f"{values['api_url']}/health")
            self.status.set("Connected" if result.get("status") == "healthy" else "Reachable")
            self._append_log("Manager connection test succeeded.")
        except (HTTPError, URLError, OSError, ValueError) as error:
            self.status.set("Disconnected")
            self._append_log(f"Connection test failed: {error}")
            messagebox.showerror("Connection failed", str(error))

    def register(self) -> None:
        token = self.token.get().strip()
        if not token:
            messagebox.showerror("Enrollment", "Enter an enrollment token from the Dejen dashboard.")
            return
        try:
            values = self._values()
            result = request_json(
                f"{values['api_url']}/agents/enroll",
                {
                    "token": token,
                    "os": {"Windows": "windows"}.get(platform.system(), "linux"),
                    "version": __version__,
                    "host": socket.gethostname(),
                    "ip_address": local_ip_for_server(values["api_url"]),
                },
            )
            values.update({"agent_id": result["agent_id"], "api_key": result["api_key"]})
            self.config = values
            save_config(values)
            self.token.delete(0, tk.END)
            self.status.set("Registered")
            self._append_log(f"Registered as {result['name']} ({result['agent_id']}). API key stored locally.")
            messagebox.showinfo("Registered", "Agent registered. The one-time token has been cleared and the API key saved locally.")
        except (HTTPError, URLError, OSError, ValueError, KeyError) as error:
            self._append_log(f"Registration failed: {error}")
            messagebox.showerror("Registration failed", str(error))

    def start(self) -> None:
        try:
            values = self._values()
            if not values.get("api_key") or not values.get("agent_id"):
                raise ValueError("Register this agent before starting collection.")
            self.config = values
            save_config(values)
            self.runtime = AgentRuntime(values, self.messages)
            self.worker = threading.Thread(target=self.runtime.run, daemon=True)
            self.worker.start()
            self.start_button.configure(state="disabled")
            self.stop_button.configure(state="normal")
        except (OSError, ValueError) as error:
            messagebox.showerror("Cannot start", str(error))

    def stop(self) -> None:
        if self.runtime:
            self.runtime.stop()
        self.start_button.configure(state="normal")
        self.stop_button.configure(state="disabled")

    def _append_log(self, message: str) -> None:
        self.log_view.configure(state="normal")
        self.log_view.insert(tk.END, f"{time.strftime('%H:%M:%S')}  {message}\n")
        self.log_view.see(tk.END)
        self.log_view.configure(state="disabled")

    def _drain_messages(self) -> None:
        while True:
            try:
                item = self.messages.get_nowait()
            except queue.Empty:
                break
            if item.get("message"):
                self._append_log(item["message"])
            if item.get("state"):
                self.status.set(item["state"])
            if "events_sent" in item:
                self.event_count.set(str(item["events_sent"]))
                self.last_sent.set(item.get("last_event_sent", "-"))
        if self.worker and not self.worker.is_alive():
            self.start_button.configure(state="normal")
            self.stop_button.configure(state="disabled")
        self.root.after(150, self._drain_messages)

    def close(self) -> None:
        self.stop()
        self.root.destroy()


def run_service(config_file: str | None = None) -> int:
    agent_config_path = Path(config_file) if config_file else config_path()
    log_path = agent_config_path.with_name("agent-service.log")
    try:
        config = load_config(agent_config_path)
        config["_config_path"] = str(agent_config_path)
        messages = queue.Queue()
        runtime = AgentRuntime(config, messages)
        worker = threading.Thread(target=runtime.run, daemon=True)
        worker.start()
        while worker.is_alive():
            try:
                message = messages.get(timeout=1)
            except Empty:
                continue
            if message.get("message"):
                _append_service_log(log_path, message["message"])
        worker.join()
    except Exception as error:
        _append_service_log(log_path, f"Dejen agent service failed: {error}")
        return 1
    return 0


def _append_service_log(path: Path, message: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as output:
        output.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}\n")
        output.flush()


def main() -> int:
    parser = argparse.ArgumentParser(description="Dejen graphical endpoint agent")
    parser.add_argument("--service", action="store_true", help="Run without the desktop UI")
    parser.add_argument("--enroll", action="store_true", help="Register using the supplied one-time token")
    parser.add_argument("--server")
    parser.add_argument("--token")
    parser.add_argument("--name")
    parser.add_argument("--config", help="Agent configuration file used by the background service")
    arguments = parser.parse_args()
    if arguments.service:
        return run_service(arguments.config)
    root = tk.Tk()
    AgentManager(root, arguments)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())