# Dejen Agent Enrollment and VirtualBox Lab

## 1. Architecture

Run PostgreSQL, FastAPI, and the React dashboard on either Kali or Windows 11. The monitored machine runs the Dejen endpoint agent. It connects directly to FastAPI on TCP 8000; Redpanda/Kafka is not used. In development, Vite serves the dashboard on TCP 3000 and proxies API routes, including `/agents`, to FastAPI.

An ADMIN creates a short-lived, single-use enrollment token. Enrollment exchanges it for a random per-agent API key. PostgreSQL stores only hashes of both secrets. The endpoint stores its API key in a user-owned configuration file with restricted permissions and clears the enrollment token after use. Token creation also creates a pending row, shown as `Never connected` until the first heartbeat. The agent sends heartbeats every 5 seconds and polls for endpoint events every second; Windows and macOS log queries use a 5-second overlap to avoid missing events between polls. Events are deduplicated before delivery. The Agents page refreshes status every 2 seconds. Status becomes `Disconnected` after 20 seconds (four missed heartbeats); set backend `DEJEN_AGENT_TIMEOUT_SECONDS` to change that threshold.

Agent events use `POST /agents/events` with the per-agent bearer key and enter the same event ingestion function as human submissions. YAML single-event/correlation rules, SQL detection functions, alert creation, and incident automation all still run. Human `POST /events` continues to require an ADMIN/ANALYST JWT. `DELETE /agents/{id}` removes the record, invalidates its key, and removes unused tokens for it. Re-enroll to issue a replacement key.

The Windows collector reads Security IDs 4624, 4625, 4688, 4720, 4726, 4728, 4729, 4732, and 4733. Enable failed Logon auditing to produce event 4625 for brute-force detection. Event 4688 requires Windows Process Creation auditing and command-line inclusion; routine process-creation records are discarded locally, while records containing `-EncodedCommand` are forwarded for detection. Linux collection recognizes SSH accepted/failed login lines in `/var/log/auth.log`. The macOS collector reads recent `sshd` entries from Unified Logging and recognizes the same SSH authentication messages. macOS log visibility varies by OS release and privacy settings. Events are queued in memory while the manager is unreachable; the queue is not durable across agent restarts.

## 2. VirtualBox networking

Choose the same virtual network for both guests:

- **Host-only** is the simplest isolated lab. Attach both VMs to the same Host-only network (often `vboxnet0`). Guests and host can communicate, but guests normally lack Internet unless a second NAT adapter is added.
- **NAT Network** gives guests outbound Internet and guest-to-guest traffic when both use the same named NAT Network. Create/enable it in VirtualBox Network Manager and attach each guest to it.
- **Bridged** places guests directly on the physical LAN. Use only on a LAN you control; other LAN devices may reach the VMs.

For an isolated test, use Host-only on both VMs; add a NAT adapter only if package downloads are needed. Avoid ordinary per-VM NAT when guests must initiate connections to each other.

Find each machine's address on the shared adapter:

```bash
# Kali
ip -4 -br address
```

```powershell
# Windows 11 PowerShell
ipconfig
```

Use that adapter's address, not `127.0.0.1`. From Kali, check `ping -c 3 MANAGER_IP` and `curl -v http://MANAGER_IP:8000/health`. From Windows, check `ping MANAGER_IP` and `Test-NetConnection MANAGER_IP -Port 8000`. Ping may be blocked; the TCP 8000 check is decisive.

## 3. Common backend setup

Only the manager needs PostgreSQL. The supplied compose file starts PostgreSQL only, using lab credentials `dejen / dejen_dev_password`; it does not start Redpanda. Keep port 5432 local to the manager and change the development password before using anything beyond a disposable lab.

FastAPI reads `DATABASE_URL` and `JWT_SECRET_KEY` from a root `.env`. Create that file on Kali from the repository root:

```bash
python3 -c 'import secrets; from pathlib import Path; Path(".env").write_text("DATABASE_URL=postgresql+psycopg://dejen:dejen_dev_password@localhost:5432/dejen_soc\nJWT_SECRET_KEY=" + secrets.token_urlsafe(48) + "\n")'
chmod 600 .env
```

On Windows PowerShell, from the repository root:

```powershell
$jwt = py -c "import secrets; print(secrets.token_urlsafe(48))"
@"
DATABASE_URL=postgresql+psycopg://dejen:dejen_dev_password@localhost:5432/dejen_soc
JWT_SECRET_KEY=$jwt
"@ | Set-Content -Encoding ascii .env
```

After updating the project, `python -m backend.database.init_db` creates the new tables. SQLAlchemy `create_all` is not a general migration system.

## 4. Direction A: Kali manager, Windows 11 agent

### A1. Run Dejen on Kali

Install Docker/Compose, Python 3, Node.js, and npm. From the extracted project directory:

```bash
cd ~/Dejen-main
sudo systemctl enable --now docker
sudo docker compose up -d postgres
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
# Create the .env file as shown above.
python -m backend.database.init_db
python -m backend.create_admin
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

In another Kali terminal:

```bash
cd ~/Dejen-main/Frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open `http://KALI_MANAGER_IP:3000`; sign in with `admin` / `Admin123!` and change that password outside a disposable lab. If UFW is already active, permit only the lab subnet, replacing the example subnet:

```bash
sudo ufw allow from 192.168.56.0/24 to any port 8000 proto tcp
sudo ufw allow from 192.168.56.0/24 to any port 3000 proto tcp
sudo ufw status
```

Do not enable UFW blindly over a remote session. The API must bind to `0.0.0.0`; the frontend's Vite proxy reaches it locally.

### A2. Enroll Windows 11

Install Python 3 with the Python Launcher and Tcl/Tk enabled. In Agents, choose Windows, enter a name, and generate the token. Paste the generated PowerShell install command into an elevated PowerShell window. It downloads and extracts the bundle, opens the GUI with enrollment details prefilled, then registers and starts the boot task after the GUI closes. Confirm the server and port, then use **Test connection**, **Register agent** if needed, and **Save**. The API key is saved locally and not displayed again. To enable file-integrity monitoring, enter one or more comma-separated folders in **FIM paths** before saving; the first start records a baseline, and later file changes are sent through the agent API.

To build a self-contained `.exe`, run in elevated PowerShell from the extracted bundle directory:

```powershell
py -m pip install --upgrade pyinstaller
py -m PyInstaller --noconfirm --onefile --windowed --name DejenAgent --collect-submodules agent --collect-submodules collectors --collect-submodules dejen_agent dejen_agent\gui.py
```

The executable is `dist\DejenAgent.exe`. Keep it in a stable directory. The config is per-user at `%LOCALAPPDATA%\Dejen\agent.json`; credentials are not embedded in the binary. To run collection automatically at machine startup, from the bundle directory in elevated PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\packaging\register_dejen_agent.ps1
```

This creates a `SYSTEM` scheduled task at machine startup. It runs the source bundle with the Python interpreter resolved during setup, or uses the built executable if present. The task restarts after failure and does not require an interactive user session. The agent retries heartbeats every five seconds and keeps collected events queued in memory while the manager is unreachable. Remove the task with `Stop-ScheduledTask -TaskName DejenAgent; Unregister-ScheduledTask -TaskName DejenAgent -Confirm:$false`.

### A3. Enable Windows audit policy

Run elevated PowerShell on the Windows VM:

```powershell
auditpol /set /subcategory:"Logon" /success:enable /failure:enable
auditpol /set /subcategory:"Account Management" /success:enable /failure:enable
auditpol /get /subcategory:"Logon"
```

4624 is successful logon and 4625 is failed logon. Account Management covers the collector's user/group IDs. Domain Group Policy may override local audit policy. Since this agent initiates connections to Kali, Windows normally needs no inbound API firewall rule; permit inbound TCP 8000 on Kali as above.

## 5. Direction B: Windows 11 manager, Kali agent

### B1. Run Dejen on Windows

Install Docker Desktop with WSL 2, Python 3, and Node.js. Start Docker Desktop, then use PowerShell in the project directory:

```powershell
docker compose up -d postgres
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
# Create the .env file as shown above.
py -m backend.database.init_db
py -m backend.create_admin
py -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

In another PowerShell window:

```powershell
cd .\Frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open `http://WINDOWS_MANAGER_IP:3000`. Run elevated PowerShell to allow only the lab subnet; replace the example CIDR:

```powershell
New-NetFirewallRule -DisplayName "Dejen API from lab" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -RemoteAddress 192.168.56.0/24
New-NetFirewallRule -DisplayName "Dejen dashboard from lab" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress 192.168.56.0/24
```

Do not expose PostgreSQL's 5432 port to the VM network. Kali needs to reach only the manager's API on 8000.

### B2. Enroll Kali

On Kali, install Python 3, Tk, and unzip. Create a Linux enrollment token in the dashboard, download the bundle, then run the generated Linux command. The GUI pre-fills enrollment values; test, register if needed, save, and start. For `/var/log/auth.log` access, add the login user to `adm`, then log out/in:

```bash
sudo apt update
sudo apt install -y python3 python3-tk unzip
sudo usermod -aG adm "$USER"
```

The source bundle contains `packaging/dejen-agent.service`. Install it as a privileged system service so it can read security logs and apply authorized firewall/isolation actions:

```bash
CONFIG_PATH="$HOME/.config/dejen-agent/agent.json"
sed "s|__CONFIG_PATH__|$CONFIG_PATH|g" /opt/dejen-agent/packaging/dejen-agent.service > /tmp/dejen-agent.service
sudo install -o root -g root -m 644 /tmp/dejen-agent.service /etc/systemd/system/dejen-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now dejen-agent.service
```

After adding `adm`, log out/in before starting the service. It uses the enrolled user's `~/.config/dejen-agent/agent.json` while running as root. Check with `sudo systemctl status dejen-agent` and `sudo journalctl -u dejen-agent -f`.

## 6. Enroll macOS as an endpoint

The macOS endpoint can enroll with either the Kali or Windows manager. Install Python 3 with Tk support, `unzip`, and OpenSSH client tools; verify Tk with `python3 -m tkinter`. In macOS **System Settings > General > Sharing**, enable **Remote Login** for the accounts used in this isolated test. The collector reads the local macOS unified log for `sshd`; it does not require an SSH server if you only need other event sources later, but SSH is the current auth event source.

In Agents, choose **macOS**, create the token, and run the generated command in Terminal. The GUI should show the Dejen manager address and token. Test connection, register, save, and start. The key is stored at `~/Library/Application Support/Dejen/agent.json` with owner-only permissions. For outbound SSH authentication tests, enable Remote Login on the macOS target and connect to it from another lab machine using a deliberately nonexistent username; availability of source IP and auth text in Unified Logging depends on macOS version/privacy settings. Confirm collected entries in the GUI before relying on an alert test.

To run headless from boot with permissions for endpoint response actions, install the supplied LaunchDaemon from the extracted bundle directory. These commands substitute the local Python path, home directory, enrolled config path, and installation path into its plist:

```bash
AGENT_DIR="$HOME/Applications/DejenAgent"
PYTHON="$(command -v python3)"
CONFIG_PATH="$HOME/Library/Application Support/Dejen/agent.json"
mkdir -p "$HOME/Library/Logs"
sed -e "s|__PYTHON__|$PYTHON|g" \
	-e "s|__AGENT_DIR__|$AGENT_DIR|g" \
	-e "s|__CONFIG_PATH__|$CONFIG_PATH|g" \
	-e "s|__HOME__|$HOME|g" \
	packaging/com.dejen.agent.plist > /tmp/com.dejen.agent.plist
sudo install -o root -g wheel -m 644 /tmp/com.dejen.agent.plist /Library/LaunchDaemons/com.dejen.agent.plist
plutil -lint /Library/LaunchDaemons/com.dejen.agent.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.dejen.agent.plist
sudo launchctl kickstart -k system/com.dejen.agent
```

Replace `AGENT_DIR` if you extracted the bundle elsewhere. Inspect service output with `tail -f "$HOME/Library/Logs/DejenAgent.log"`. Stop and unregister with `sudo launchctl bootout system /Library/LaunchDaemons/com.dejen.agent.plist`; after changing the plist, bootstrap it again.

## 7. Safe failed-login test

The YAML `SSH Brute Force` rule fires on five or more `authentication_failed` events from one source IP within five minutes. Test only between your own lab guests. Use a deliberately nonexistent username so a real account cannot be locked out; do not repeatedly guess a real password.

For Direction B, start Kali's SSH service with `sudo systemctl enable --now ssh`. From Windows PowerShell, run this command five times, entering any wrong password when prompted:

```powershell
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1 dejen-lab-no-such-user@KALI_IP
```

For Direction A, enable Windows OpenSSH Server from elevated PowerShell and restrict its firewall rule to the Kali lab IP:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
New-NetFirewallRule -DisplayName "Lab SSH from Kali" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 22 -RemoteAddress KALI_IP
```

From Kali, run five single-prompt SSH attempts with a nonexistent username:

```bash
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1 dejen-lab-no-such-user@WINDOWS_IP
```

Confirm Security event 4625 is present and the Windows agent can read it. Some Windows/OpenSSH configurations may not emit a Security 4625 for SSH failures. If so, use Direction B's Kali auth-log test or submit five controlled `LOGIN_FAILURE` events through JWT-protected `/events` from an isolated test script. Open **Alerts** and **Incidents**; the YAML brute-force alert is HIGH and automatically creates an incident. Stop after confirming it.

## 8. Troubleshooting

- **Connection refused or timeout:** Check both VMs share the expected VirtualBox network, use the manager's shared-adapter IP, start Uvicorn with `--host 0.0.0.0`, and permit inbound TCP 8000 on the manager firewall. Check `curl http://MANAGER_IP:8000/health` or `Test-NetConnection MANAGER_IP -Port 8000` from the agent.
- **401 on enrollment:** Token is expired, already used, malformed, or copied with whitespace. Generate a new one. Enrollment never uses the human admin password.
- **401 on heartbeat/events:** Removing an agent revokes its key. Re-enroll and ensure the saved Manager/server and port are correct.
- **403:** Creating tokens and removing agents require ADMIN. ADMIN/ANALYST can list; VIEWER cannot.
- **422:** Check agent name, selected OS, required event fields, and severity (`LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`).
- **Expired token:** Tokens are single-use. Choose a new expiry and issue a fresh one; do not reuse across machines.
- **No events:** Check Windows audit policy and elevated task, or Kali `adm` membership/read access. Confirm a source event exists in Event Viewer/auth.log. Linux collection starts at the end of the file and forwards new recognized SSH lines only.
- **No macOS events:** Confirm Remote Login is enabled and `log show --style json --last 1m --info --predicate 'process == "sshd"'` returns recent authentication entries. macOS may redact or omit fields; check the agent GUI log and run the command locally before testing detection.
- **Disconnected:** Heartbeat runs every 20 seconds; allow 90 seconds before diagnosing. Inspect the GUI log, `journalctl --user -u dejen-agent`, or Task Scheduler history. Check API reachability, firewall, saved key, and system clock.
- **Agents view/API missing:** Restart Vite after changing its proxy. A reverse proxy must route `/agents/*` to FastAPI. Set `VITE_AGENT_MANAGER_URL` at frontend build time only when the dashboard hostname cannot identify the API manager.

## 9. Endpoint response actions

After deploying response actions to an existing database, run `python -m backend.database.init_db` once to create the `endpoint_actions` table, then restart FastAPI and update/restart the endpoint agent bundles. ADMIN and ANALYST users can request actions from each alert. Requests are stored with the requesting username and delivered only to the assigned agent using its bearer key.

- **Block / Unblock:** Uses the alert endpoint's registered IP and installs/removes Dejen-managed local-address firewall rules on that endpoint only. It does not target the alert's remote source IP, the manager, or other endpoints. Recovery commands wait in the queue until the endpoint checks in.
- **Isolate / Unisolate:** Isolate saves the endpoint's enabled interfaces before disabling them. Unisolate restores only those saved interfaces. Since full isolation cuts the command channel, an administrator must restore enough local network access for the queued recovery command to arrive.
- **Disconnect / Connect:** Disconnect disables the endpoint agent's automatic startup, stops it, revokes its API key, and marks it disconnected immediately. ADMIN-only Connect issues a 15-minute, single-use token for local re-enrollment; run Agent Manager on the endpoint with that token, then re-enable its startup task/service.

Windows runs as `SYSTEM`; Linux uses a root systemd service; macOS uses a root LaunchDaemon. These are required for host firewall and network-adapter changes. Check action status in the alert row before assuming containment succeeded. Isolation disables every non-loopback network adapter and can only be reversed locally; Disconnect disables the agent's startup service/task.

## API reference

- `POST /agents/tokens` (ADMIN): `{ "name", "os", "expires_in_minutes" }`.
- `POST /agents/enroll`: `{ "token", "version", "host" }` returns the agent ID and one-time-visible API key.
- `POST /agents/heartbeat`, `POST /agents/events`: per-agent bearer key.
- `GET /agents/actions`, `PATCH /agents/actions/{action_id}`: per-agent command polling and acknowledgement.
- `POST /alerts/{alert_id}/response-actions`, `GET /alerts/{alert_id}/response-actions`: ADMIN/ANALYST response action request and audit status.
- `GET /agents`: ADMIN/ANALYST fleet list and derived status.
- `DELETE /agents/{id}` (ADMIN): remove registration and revoke key.
- `GET /agents/installers/windows` and `/agents/installers/linux`: GUI source bundle downloads.