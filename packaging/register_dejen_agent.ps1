$ErrorActionPreference = "Stop"

$AgentRoot = Split-Path $PSScriptRoot -Parent
$Executable = Join-Path $AgentRoot "dist\DejenAgent.exe"
$TaskName = "DejenAgent"
$ConfigPath = Join-Path $env:LOCALAPPDATA "Dejen\agent.json"
if (-not (Test-Path $ConfigPath)) {
    throw "Register the agent in Dejen Agent Manager before installing auto-start. Missing config: $ConfigPath"
}
& icacls.exe $ConfigPath /grant:r "NT AUTHORITY\SYSTEM:(R)" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not grant the Windows service access to the agent configuration."
}
$ServiceArguments = "--service --config `"$ConfigPath`""
$PythonLauncher = (Get-Command py.exe -ErrorAction SilentlyContinue).Source
if ($PythonLauncher) {
    $Python = (& $PythonLauncher -3 -c "import sys; print(sys.executable)").Trim()
    if (-not $Python -or -not (Test-Path $Python)) {
        throw "Could not resolve the Python executable for the startup task."
    }
    $Action = New-ScheduledTaskAction -Execute $Python -Argument "-m dejen_agent.gui $ServiceArguments" -WorkingDirectory $AgentRoot
} elseif (Test-Path $Executable) {
    $Action = New-ScheduledTaskAction -Execute $Executable -Argument $ServiceArguments -WorkingDirectory $AgentRoot
} else {
    throw "Build dist\DejenAgent.exe or install the Python Launcher for Windows."
}
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -MultipleInstances IgnoreNew
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "Dejen Agent scheduled task installed and started for $UserId."