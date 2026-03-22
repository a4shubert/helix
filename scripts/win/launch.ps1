<#
  Start brokers, reset the store, and launch the full Helix stack.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

$RunDir = Join-Path $RepoRoot ".helix/run"
$LogDir = Join-Path $RepoRoot ".helix/logs"
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

& (Join-Path $ScriptDir "brokers_start.ps1")
Start-Sleep -Seconds 5

& (Join-Path $ScriptDir "store_init_clean_state.ps1")

Write-Host "[launch] Starting helix-rest..."
$rest = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $ScriptDir "rest_start_dev.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "rest.log") `
    -RedirectStandardError (Join-Path $LogDir "rest.log")
$rest.Id | Set-Content (Join-Path $RunDir "rest.pid")

Start-Sleep -Seconds 4

Write-Host "[launch] Starting helix-runtime..."
$runtime = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $ScriptDir "runtime_start.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "runtime.log") `
    -RedirectStandardError (Join-Path $LogDir "runtime.log")
$runtime.Id | Set-Content (Join-Path $RunDir "runtime.pid")

Start-Sleep -Seconds 3

Write-Host "[launch] Starting helix-web..."
$web = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $ScriptDir "web_start_dev.ps1")) `
    -PassThru `
    -RedirectStandardOutput (Join-Path $LogDir "web.log") `
    -RedirectStandardError (Join-Path $LogDir "web.log")
$web.Id | Set-Content (Join-Path $RunDir "web.pid")

Write-Host "[launch] Helix is starting."
Write-Host "[launch] REST: $Env:HELIX_API_URL"
Write-Host "[launch] Web: $Env:HELIX_WEB_URL"
Write-Host "[launch] RabbitMQ UI: $Env:HELIX_RABBITMQ_MANAGEMENT_URL"
Write-Host "[launch] Kafka UI: $Env:HELIX_KAFKA_UI_URL"
Write-Host "[launch] Logs:"
Write-Host "  $(Join-Path $LogDir 'rest.log')"
Write-Host "  $(Join-Path $LogDir 'runtime.log')"
Write-Host "  $(Join-Path $LogDir 'web.log')"
