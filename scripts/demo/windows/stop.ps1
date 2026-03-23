<#
  Stop the full Helix stack started by launch.ps1 or launch_full.ps1.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$RunDir = Join-Path $RepoRoot ".helix/run"
$EnvScript = Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

function Get-PortFromUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    return ([System.Uri]$Url).Port
}

function Stop-PidFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $PidFile = Join-Path $RunDir "$Name.pid"
    if (-not (Test-Path $PidFile)) {
        Write-Host "[stop] ${Name}: no pid file"
        return
    }

    $PidValue = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $PidValue) {
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
        Write-Host "[stop] ${Name}: empty pid file removed"
        return
    }

    $Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
    if ($Process) {
        Write-Host "[stop] Stopping ${Name} (PID $PidValue)..."
        Stop-Process -Id $PidValue -Force -ErrorAction SilentlyContinue
    }
    else {
        Write-Host "[stop] ${Name}: process $PidValue not running"
    }

    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
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
            Write-Host "[stop] Stopping stray listener on port $Port (PID $pid)..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}

Stop-PidFile -Name "web"
Stop-PidFile -Name "runtime"
Stop-PidFile -Name "rest"

Stop-ListenerOnPort -Port (Get-PortFromUrl -Url $Env:HELIX_API_URL)
Stop-ListenerOnPort -Port ([int]$Env:HELIX_WEB_PORT)

& (Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "brokers_stop.ps1")

Write-Host "[stop] Helix stack stopped."
