import ipaddress
import json
import os
import platform
import re
import shlex
import subprocess
import tempfile
from pathlib import Path
from typing import Any


class ResponseActionError(RuntimeError):
    pass


class ActionReceiptStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        try:
            self.receipts = json.loads(self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            self.receipts = {}
        except (OSError, json.JSONDecodeError) as error:
            raise ResponseActionError(f"Cannot load response action receipts: {error}") from error
        if not isinstance(self.receipts, dict):
            raise ResponseActionError("Response action receipts must be a JSON object")

    def get(self, action_id: str) -> dict[str, Any] | None:
        receipt = self.receipts.get(action_id)
        return receipt if isinstance(receipt, dict) else None

    def save(self, action_id: str, receipt: dict[str, Any]) -> None:
        self.receipts[action_id] = receipt
        self._write()

    def remove(self, action_id: str) -> None:
        if action_id not in self.receipts:
            return
        del self.receipts[action_id]
        self._write()

    def _write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_path = tempfile.mkstemp(dir=self.path.parent, text=True)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as target:
                json.dump(self.receipts, target, sort_keys=True)
                target.flush()
                os.fsync(target.fileno())
            os.replace(temporary_path, self.path)
            try:
                self.path.chmod(0o600)
            except OSError:
                pass
        except OSError as error:
            try:
                os.unlink(temporary_path)
            except OSError:
                pass
            raise ResponseActionError(f"Cannot persist response action receipts: {error}") from error


def execute_endpoint_action(
    action: dict[str, Any], *, state_dir: str | Path | None = None
) -> bool:
    """Execute one allow-listed response action; return True when the agent must stop."""
    action_type = action.get("action_type")
    action_id = str(action.get("action_id", ""))
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", action_id):
        raise ResponseActionError("Invalid action identifier")

    system = platform.system()
    if action_type in {"BLOCK_ENDPOINT_IP", "UNBLOCK_ENDPOINT_IP"}:
        source_ip = action.get("target_ip")
        try:
            address = ipaddress.ip_address(source_ip)
        except ValueError as error:
            raise ResponseActionError("Invalid endpoint IP address") from error
        if address.is_unspecified or address.is_multicast or address.is_loopback:
            raise ResponseActionError("Refusing to block a special-use endpoint IP address")
        if action_type == "BLOCK_ENDPOINT_IP":
            _block_local_ip(system, action_id, str(address))
        else:
            _unblock_local_ip(system, str(address))
        return False
    if action_type == "ISOLATE_ENDPOINT":
        _isolate(system, _state_path(state_dir))
        return False
    if action_type == "UNISOLATE_ENDPOINT":
        _unisolate(system, _state_path(state_dir))
        return False
    if action_type == "DISCONNECT_AGENT":
        _disable_agent_startup(system)
        return True
    raise ResponseActionError("Unsupported endpoint response action")


def _state_path(state_dir: str | Path | None) -> Path:
    return Path(state_dir or Path.home() / ".config" / "dejen-agent") / "network_isolation.json"


def _run(command: list[str], *, input_text: str | None = None) -> str:
    try:
        result = subprocess.run(
            command,
            input=input_text,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ResponseActionError(str(error)) from error
    if result.returncode != 0:
        message = (result.stderr or result.stdout or "Command failed").strip()
        raise ResponseActionError(message[:1000])
    return result.stdout.strip()


def _block_local_ip(system: str, action_id: str, address: str) -> None:
    if system == "Windows":
        short_id = action_id.replace("-", "")
        script = (
            f"$ip='{address}'; "
            f"$in='DejenBlock-{short_id}-In'; $out='DejenBlock-{short_id}-Out'; "
            "if (-not (Get-NetFirewallRule -Name $in -ErrorAction SilentlyContinue)) { "
            "New-NetFirewallRule -Name $in -DisplayName $in -Direction Inbound "
            "-Action Block -LocalAddress $ip -Profile Any | Out-Null }; "
            "if (-not (Get-NetFirewallRule -Name $out -ErrorAction SilentlyContinue)) { "
            "New-NetFirewallRule -Name $out -DisplayName $out -Direction Outbound "
            "-Action Block -LocalAddress $ip -Profile Any | Out-Null }"
        )
        _run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script])
    elif system == "Linux":
        _block_local_ip_iptables(action_id, address)
    elif system == "Darwin":
        _block_local_ip_pf(address)
    else:
        raise ResponseActionError(f"IP blocking is unsupported on {system}")


def _block_local_ip_iptables(action_id: str, address: str) -> None:
    binary = "ip6tables" if ipaddress.ip_address(address).version == 6 else "iptables"
    tag = f"dejen-{action_id}"
    for chain, selector in (("INPUT", "-d"), ("OUTPUT", "-s")):
        rule = [binary, "-C", chain, selector, address, "-m", "comment", "--comment", tag, "-j", "DROP"]
        try:
            result = subprocess.run(rule, capture_output=True, text=True, timeout=15, check=False)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise ResponseActionError(str(error)) from error
        if result.returncode == 0:
            continue
        _run([binary, "-I", chain, "1", selector, address, "-m", "comment", "--comment", tag, "-j", "DROP"])


def _block_local_ip_pf(address: str) -> None:
    pfctl = "/sbin/pfctl"
    status = _run([pfctl, "-s", "info"])
    if "Status: Enabled" not in status:
        raise ResponseActionError("macOS PF firewall is disabled; no firewall change was made")
    config_path = Path("/etc/pf.conf")
    anchor_path = Path("/etc/pf.anchors/dejen-agent")
    try:
        config = config_path.read_text(encoding="utf-8")
        rules = anchor_path.read_text(encoding="utf-8") if anchor_path.exists() else ""
        rules_to_add = (
            f"block drop quick from {address} to any\n"
            f"block drop quick from any to {address}\n"
        )
        if rules_to_add not in rules:
            anchor_path.write_text(rules + rules_to_add, encoding="utf-8")
        anchor_lines = (
            'anchor "dejen-agent"',
            'load anchor "dejen-agent" from "/etc/pf.anchors/dejen-agent"',
        )
        if not all(line in config for line in anchor_lines):
            config_path.write_text(config.rstrip() + "\n" + "\n".join(anchor_lines) + "\n", encoding="utf-8")
        _run([pfctl, "-f", str(config_path)])
    except OSError as error:
        raise ResponseActionError(f"Could not update PF rules: {error}") from error


def _unblock_local_ip(system: str, address: str) -> None:
    if system == "Windows":
        escaped_address = address.replace("'", "''")
        script = (
            f"$ip='{escaped_address}'; "
            "Get-NetFirewallRule -Name 'DejenBlock-*' -ErrorAction SilentlyContinue | "
            "Where-Object { $filter = $_ | Get-NetFirewallAddressFilter; "
            "$filter.LocalAddress -contains $ip } | Remove-NetFirewallRule -ErrorAction Stop"
        )
        _run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script])
    elif system == "Linux":
        binary = "ip6tables" if ipaddress.ip_address(address).version == 6 else "iptables"
        for chain in ("INPUT", "OUTPUT"):
            rules = _run([binary, "-S", chain])
            for line in rules.splitlines():
                tokens = shlex.split(line)
                if not tokens or tokens[0] != "-A" or "--comment" not in tokens:
                    continue
                comment_index = tokens.index("--comment")
                if not tokens[comment_index + 1].startswith("dejen-"):
                    continue
                address_flag = "-d" if chain == "INPUT" else "-s"
                if address_flag not in tokens or tokens[tokens.index(address_flag) + 1].split("/")[0] != address:
                    continue
                tokens[0] = "-D"
                _run([binary, *tokens[1:]])
    elif system == "Darwin":
        _unblock_local_ip_pf(address)
    else:
        raise ResponseActionError(f"IP unblocking is unsupported on {system}")


def _unblock_local_ip_pf(address: str) -> None:
    pfctl = "/sbin/pfctl"
    status = _run([pfctl, "-s", "info"])
    if "Status: Enabled" not in status:
        raise ResponseActionError("macOS PF firewall is disabled; no firewall change was made")
    anchor_path = Path("/etc/pf.anchors/dejen-agent")
    try:
        if anchor_path.exists():
            rules = [
                line
                for line in anchor_path.read_text(encoding="utf-8").splitlines()
                if address not in line
            ]
            anchor_path.write_text("\n".join(rules) + ("\n" if rules else ""), encoding="utf-8")
        _run([pfctl, "-f", "/etc/pf.conf"])
    except OSError as error:
        raise ResponseActionError(f"Could not remove endpoint IP PF rules: {error}") from error


def _isolate(system: str, state_path: Path) -> None:
    if system == "Windows":
        query = (
            "@(Get-NetAdapter -IncludeHidden | Where-Object Status -eq 'Up' | "
            "Select-Object -ExpandProperty Name) | ConvertTo-Json -Compress"
        )
        output = _run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", query])
        names = json.loads(output) if output else []
        if isinstance(names, str):
            names = [names]
        interfaces = [name for name in names if isinstance(name, str) and name]
    elif system == "Linux":
        output = _run(["ip", "-o", "link", "show", "up"])
        interfaces = [
            match.group(1)
            for line in output.splitlines()
            if (match := re.match(r"\d+:\s+([^:@]+)", line)) and match.group(1) != "lo"
        ]
    elif system == "Darwin":
        output = _run(["/sbin/ifconfig", "-l"])
        interfaces = [name for name in output.split() if name != "lo0"]
    else:
        raise ResponseActionError(f"Network isolation is unsupported on {system}")

    if not interfaces:
        raise ResponseActionError("No active non-loopback network interface was found")
    state = {"system": system, "interfaces": interfaces}
    _write_state(state_path, state)
    for interface in interfaces:
        if system == "Windows":
            escaped_interface = interface.replace("'", "''")
            command = (
                f"Disable-NetAdapter -Name '{escaped_interface}' "
                "-Confirm:$false -ErrorAction Stop"
            )
            _run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command])
        elif system == "Linux":
            _run(["ip", "link", "set", "dev", interface, "down"])
        else:
            _run(["/sbin/ifconfig", interface, "down"])


def _unisolate(system: str, state_path: Path) -> None:
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ResponseActionError("No Dejen isolation state is saved on this endpoint") from error
    except (OSError, json.JSONDecodeError) as error:
        raise ResponseActionError(f"Cannot load isolation state: {error}") from error
    if state.get("system") != system or not isinstance(state.get("interfaces"), list):
        raise ResponseActionError("Saved isolation state does not match this endpoint")
    for interface in state["interfaces"]:
        if not isinstance(interface, str) or interface in {"lo", "lo0"}:
            continue
        if system == "Windows":
            escaped_interface = interface.replace("'", "''")
            command = f"Enable-NetAdapter -Name '{escaped_interface}' -Confirm:$false -ErrorAction Stop"
            _run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command])
        elif system == "Linux":
            _run(["ip", "link", "set", "dev", interface, "up"])
        elif system == "Darwin":
            _run(["/sbin/ifconfig", interface, "up"])
        else:
            raise ResponseActionError(f"Network restoration is unsupported on {system}")
    try:
        state_path.unlink()
    except FileNotFoundError:
        pass


def _write_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_path = tempfile.mkstemp(dir=path.parent, text=True)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as target:
            json.dump(state, target)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary_path, path)
        try:
            path.chmod(0o600)
        except OSError:
            pass
    except OSError as error:
        try:
            os.unlink(temporary_path)
        except OSError:
            pass
        raise ResponseActionError(f"Cannot persist isolation state: {error}") from error


def _disable_agent_startup(system: str) -> None:
    if system == "Windows":
        _run([
            "powershell.exe",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Disable-ScheduledTask -TaskName 'DejenAgent' -ErrorAction Stop | Out-Null",
        ])
    elif system == "Linux":
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            _run(["systemctl", "disable", "dejen-agent.service"])
        else:
            _run(["systemctl", "--user", "disable", "dejen-agent.service"])
    elif system == "Darwin":
        domain = "system" if hasattr(os, "geteuid") and os.geteuid() == 0 else f"gui/{os.getuid()}"
        _run(["launchctl", "disable", f"{domain}/com.dejen.agent"])
    else:
        raise ResponseActionError(f"Agent disconnection is unsupported on {system}")