<#
  Stop local RabbitMQ and Kafka services for Helix development.
#>

$ScriptDir = $PSScriptRoot
$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
    Write-Host "[brokers_stop] Homebrew not found. Install Homebrew first."
    exit 1
}

if (Test-Path $Env:HELIX_KAFKA_UI_PID_FILE) {
    $kafkaUiPid = Get-Content $Env:HELIX_KAFKA_UI_PID_FILE -ErrorAction SilentlyContinue
    if ($kafkaUiPid) {
        Write-Host "[brokers_stop] Stopping Kafka UI (PID $kafkaUiPid)..."
        Stop-Process -Id $kafkaUiPid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $Env:HELIX_KAFKA_UI_PID_FILE -Force -ErrorAction SilentlyContinue
}

Write-Host "[brokers_stop] Stopping Kafka..."
brew services stop kafka

Write-Host "[brokers_stop] Stopping RabbitMQ..."
brew services stop rabbitmq

Write-Host "[brokers_stop] Broker services:"
brew services list | Select-String "rabbitmq|kafka"
