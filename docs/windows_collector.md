# Windows Security Event Collector

`collectors.agent.collectors.windows.WindowsEventCollector` queries the local Windows Security log with PowerShell `Get-WinEvent` and emits DEJEN normalized events. The default IDs cover logons (`4624`, `4625`), process creation (`4688`), user creation/deletion (`4720`, `4726`), and group membership changes (`4728`, `4729`, `4732`, `4733`). All events with those configured IDs are forwarded, including ordinary process starts. Account names, source IPs, event time, computer, record ID, provider, and the original event data are retained when present.

To collect process-creation telemetry and command lines, run the following in elevated PowerShell on the Windows endpoint:

```powershell
auditpol /set /subcategory:"Process Creation" /success:enable
$auditKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit"
New-Item -Path $auditKey -Force | Out-Null
New-ItemProperty -Path $auditKey -Name ProcessCreationIncludeCmdLine_Enabled -PropertyType DWord -Value 1 -Force | Out-Null
```

For brute-force detection, Windows must also audit failed logons. Enable and verify the `Logon` failure policy in elevated PowerShell:

```powershell
auditpol /set /subcategory:"Logon" /failure:enable
auditpol /get /subcategory:"Logon"
```

Create five failed sign-ins within five minutes using a disposable or nonexistent username. Confirm Windows records Security event `4625` in Event Viewer. The agent sends those events as `authentication_failed`; the platform alerts on the fifth failure from one source IP, or from one endpoint when Windows provides no source IP.

After updating the agent bundle and restarting the agent, a safe detector check is:

```powershell
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes('Write-Output "Dejen detection test"'))
powershell.exe -NoProfile -EncodedCommand $encoded
```

This creates a process event with a harmless command. The platform should show the `process_creation` event and an `Encoded PowerShell Command` alert.

## Install and run

Run in an elevated PowerShell session on a supported Windows host. From the repository root:

```powershell
py -m pip install -r requirements.txt
Copy-Item .env.example .env -ErrorAction SilentlyContinue
$env:WINDOWS_EVENT_COLLECTION_INTERVAL = "10"
py -m collectors.agent.collectors.windows
```

The example copy does not replace an existing `.env`. Set `REDPANDA_BROKERS` and `REDPANDA_TOPIC` to a reachable Redpanda cluster before running. `WINDOWS_EVENT_IDS` accepts comma-separated IDs. `WINDOWS_EVENT_COLLECTION_INTERVAL` sets the query window and polling interval in seconds. Repeated records keep a deterministic UUID based on computer, record ID, and event ID.

## Test and troubleshoot

```sh
python -m unittest tests/test_windows_collector.py -v
```

Access denied usually means the process lacks permission to read the Security log. PowerShell missing or unavailable logs are reported as collection errors. Malformed records and records without timestamps are logged and skipped. The runtime keeps failed deliveries in memory and retries them; stopping with pending events is reported, but the queue is not durable across process crashes.