<#
  Start brokers and launch the Helix production stack without rebuilding REST or web.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$EnvScript = Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "env.ps1"
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
            Write-Host "[start] Stopping stray listener on port $Port (PID $pid)..."
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
        Write-Host "[start] $Name failed to stay running."
        if (Test-Path $LogPath) {
            Write-Host "[start] Last $Name log lines:"
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

& (Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "brokers_start.ps1")
Start-Sleep -Seconds 5

Write-Host "[start] Building helix-rest and helix-web production artifacts..."
& (Join-Path $ScriptDir "build.ps1")

$Env:ASPNETCORE_ENVIRONMENT = "Production"

Write-Host "[start] Starting helix-rest..."
$rest = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "rest_start_prod.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "rest.log") `
    -RedirectStandardError (Join-Path $LogDir "rest.log")
$rest.Id | Set-Content (Join-Path $RunDir "rest.pid")

Start-Sleep -Seconds 4
Assert-ProcessRunning -Name "rest" -Pid $rest.Id -LogPath (Join-Path $LogDir "rest.log")

Write-Host "[start] Starting helix-runtime..."
$runtime = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "runtime_start.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "runtime.log") `
    -RedirectStandardError (Join-Path $LogDir "runtime.log")
$runtime.Id | Set-Content (Join-Path $RunDir "runtime.pid")

Start-Sleep -Seconds 3
Assert-ProcessRunning -Name "runtime" -Pid $runtime.Id -LogPath (Join-Path $LogDir "runtime.log")

Write-Host "[start] Starting helix-web..."
$web = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "web_start_prod.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "web.log") `
    -RedirectStandardError (Join-Path $LogDir "web.log")
$web.Id | Set-Content (Join-Path $RunDir "web.pid")

Start-Sleep -Seconds 3
Assert-ProcessRunning -Name "web" -Pid $web.Id -LogPath (Join-Path $LogDir "web.log")

Write-Host "[start] Helix is starting."
Write-Host "[start] REST: $Env:HELIX_API_URL"
Write-Host "[start] Web: $Env:HELIX_WEB_URL"
Write-Host "[start] RabbitMQ UI: $Env:HELIX_RABBITMQ_MANAGEMENT_URL"
Write-Host "[start] Kafka UI: $Env:HELIX_KAFKA_UI_URL"
Write-Host "[start] Logs:"
Write-Host "  $(Join-Path $LogDir 'rest.log')"
Write-Host "  $(Join-Path $LogDir 'runtime.log')"
Write-Host "  $(Join-Path $LogDir 'web.log')"
