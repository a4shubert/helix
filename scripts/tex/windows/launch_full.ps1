<#
  Start brokers, reset the store, build production artifacts, and launch the full Helix stack.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

$RunDir = Join-Path $RepoRoot ".helix/run"
$LogDir = Join-Path $RepoRoot ".helix/logs"
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Get-PortFromUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    return ([System.Uri]$Url).Port
}

function Clear-StalePidFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $PidFile = Join-Path $RunDir "$Name.pid"
    if (-not (Test-Path $PidFile)) {
        return
    }

    $PidValue = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $PidValue) {
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
        return
    }

    if (-not (Get-Process -Id $PidValue -ErrorAction SilentlyContinue)) {
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
}

function Stop-ListenerOnPort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        $pid = $connection.OwningProcess
        if ($pid) {
            Write-Host "[launch_full] Stopping stray listener on port $Port (PID $pid)..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}

function Assert-ProcessRunning {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [int]$Pid,
        [Parameter(Mandatory = $true)]
        [string]$LogPath
    )

    $process = Get-Process -Id $Pid -ErrorAction SilentlyContinue
    if (-not $process) {
        Write-Host "[launch_full] $Name failed to stay running."
        if (Test-Path $LogPath) {
            Write-Host "[launch_full] Last $Name log lines:"
            Get-Content $LogPath -Tail 40
        }
        exit 1
    }
}

Clear-StalePidFile -Name "rest"
Clear-StalePidFile -Name "runtime"
Clear-StalePidFile -Name "web"

Stop-ListenerOnPort -Port (Get-PortFromUrl -Url $Env:HELIX_API_URL)
Stop-ListenerOnPort -Port ([int]$Env:HELIX_WEB_PORT)

& (Join-Path $ScriptDir "brokers_start.ps1")
Start-Sleep -Seconds 5

& (Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "demo/windows") "clean.ps1")

Write-Host "[launch_full] Building helix-rest production publish..."
& (Join-Path $ScriptDir "rest_build.ps1")

Write-Host "[launch_full] Building helix-web production bundle..."
& (Join-Path $ScriptDir "web_build.ps1")

$Env:ASPNETCORE_ENVIRONMENT = "Production"

Write-Host "[launch_full] Starting helix-rest..."
$rest = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $ScriptDir "rest_start_prod.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "rest.log") `
    -RedirectStandardError (Join-Path $LogDir "rest.log")
$rest.Id | Set-Content (Join-Path $RunDir "rest.pid")

Start-Sleep -Seconds 4
Assert-ProcessRunning -Name "rest" -Pid $rest.Id -LogPath (Join-Path $LogDir "rest.log")

Write-Host "[launch_full] Starting helix-runtime..."
$runtime = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $ScriptDir "runtime_start.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "runtime.log") `
    -RedirectStandardError (Join-Path $LogDir "runtime.log")
$runtime.Id | Set-Content (Join-Path $RunDir "runtime.pid")

Start-Sleep -Seconds 3
Assert-ProcessRunning -Name "runtime" -Pid $runtime.Id -LogPath (Join-Path $LogDir "runtime.log")

Write-Host "[launch_full] Starting helix-web..."
$web = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $ScriptDir "web_start_prod.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "web.log") `
    -RedirectStandardError (Join-Path $LogDir "web.log")
$web.Id | Set-Content (Join-Path $RunDir "web.pid")

Start-Sleep -Seconds 3
Assert-ProcessRunning -Name "web" -Pid $web.Id -LogPath (Join-Path $LogDir "web.log")

Write-Host "[launch_full] Helix is starting."
Write-Host "[launch_full] REST: $Env:HELIX_API_URL"
Write-Host "[launch_full] Web: $Env:HELIX_WEB_URL"
Write-Host "[launch_full] RabbitMQ UI: $Env:HELIX_RABBITMQ_MANAGEMENT_URL"
Write-Host "[launch_full] Kafka UI: $Env:HELIX_KAFKA_UI_URL"
Write-Host "[launch_full] Logs:"
Write-Host "  $(Join-Path $LogDir 'rest.log')"
Write-Host "  $(Join-Path $LogDir 'runtime.log')"
Write-Host "  $(Join-Path $LogDir 'web.log')"
