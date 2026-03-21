<#
  Start local RabbitMQ and Kafka services for Helix development.
#>

$ScriptDir = $PSScriptRoot
$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
    Write-Host "[brokers_start] Homebrew not found. Install Homebrew first."
    exit 1
}

$rabbitInstalled = brew list --versions rabbitmq 2>$null
if (-not $rabbitInstalled) {
    Write-Host "[brokers_start] rabbitmq is not installed. Run: brew install rabbitmq"
    exit 1
}

$kafkaInstalled = brew list --versions kafka 2>$null
if (-not $kafkaInstalled) {
    Write-Host "[brokers_start] kafka is not installed. Run: brew install kafka"
    exit 1
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Host "[brokers_start] java not found. Ensure HELIX_JAVA_HOME is valid."
    exit 1
}

if (-not (Test-Path $Env:HELIX_KAFKA_UI_DIR)) {
    New-Item -ItemType Directory -Path $Env:HELIX_KAFKA_UI_DIR -Force | Out-Null
}

if (-not (Test-Path $Env:HELIX_KAFKA_UI_JAR)) {
    Write-Host "[brokers_start] Installing Provectus Kafka UI JAR..."
    Invoke-WebRequest `
        -Uri "https://github.com/provectus/kafka-ui/releases/download/v0.7.2/kafka-ui-api-v0.7.2.jar" `
        -OutFile $Env:HELIX_KAFKA_UI_JAR
}

Write-Host "[brokers_start] Starting RabbitMQ..."
brew services start rabbitmq

Write-Host "[brokers_start] Starting Kafka..."
brew services start kafka

$kafkaUiRunning = $false
if (Test-Path $Env:HELIX_KAFKA_UI_PID_FILE) {
    $existingPid = Get-Content $Env:HELIX_KAFKA_UI_PID_FILE -ErrorAction SilentlyContinue
    if ($existingPid) {
        $proc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($proc) {
            $kafkaUiRunning = $true
            Write-Host "[brokers_start] Kafka UI already running with PID $existingPid"
        }
    }
}

if (-not $kafkaUiRunning) {
    Write-Host "[brokers_start] Starting Provectus Kafka UI..."
    $process = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $Env:HELIX_KAFKA_UI_JAR) `
        -WorkingDirectory $Env:HELIX_KAFKA_UI_DIR `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput $Env:HELIX_KAFKA_UI_LOG_FILE `
        -RedirectStandardError $Env:HELIX_KAFKA_UI_LOG_FILE `
        -Environment @{
            "SERVER_PORT" = $Env:HELIX_KAFKA_UI_PORT
            "KAFKA_CLUSTERS_0_NAME" = "helix-local"
            "KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS" = $Env:HELIX_KAFKA_BOOTSTRAP_SERVERS
        }
    $process.Id | Set-Content $Env:HELIX_KAFKA_UI_PID_FILE
}

Write-Host "[brokers_start] Broker services:"
brew services list | Select-String "rabbitmq|kafka"

Write-Host "[brokers_start] RabbitMQ management UI: $Env:HELIX_RABBITMQ_MANAGEMENT_URL"
Write-Host "[brokers_start] Kafka bootstrap servers: $Env:HELIX_KAFKA_BOOTSTRAP_SERVERS"
Write-Host "[brokers_start] Kafka UI: $Env:HELIX_KAFKA_UI_URL"

Start-Process $Env:HELIX_RABBITMQ_MANAGEMENT_URL
Start-Process $Env:HELIX_KAFKA_UI_URL
