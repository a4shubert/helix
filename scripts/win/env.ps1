<#
  Common environment setup for Windows/PowerShell Helix runs.
#>

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$DotnetHome = Join-Path $HOME ".dotnet"
$DotnetHomeExe = Join-Path $DotnetHome "dotnet"
$DotnetHomeExeWin = Join-Path $DotnetHome "dotnet.exe"
if ((Test-Path $DotnetHomeExe) -or (Test-Path $DotnetHomeExeWin)) {
    if ($Env:PATH -notlike "$DotnetHome*") {
        $Env:PATH = "$DotnetHome;$Env:PATH"
    }
    $DotnetTools = Join-Path $DotnetHome "tools"
    if (Test-Path $DotnetTools -and $Env:PATH -notlike "$DotnetTools*") {
        $Env:PATH = "$DotnetTools;$Env:PATH"
    }
    $Env:DOTNET_ROOT = $DotnetHome
}

if (-not $Env:HELIX_DB_PATH -or [string]::IsNullOrWhiteSpace($Env:HELIX_DB_PATH)) {
    $Env:HELIX_DB_PATH = Join-Path $RepoRoot "helix-store/helix.db"
}
if (-not $Env:HELIX_API_URL -or [string]::IsNullOrWhiteSpace($Env:HELIX_API_URL)) {
    $Env:HELIX_API_URL = "http://localhost:5057"
}
if (-not $Env:ASPNETCORE_URLS -or [string]::IsNullOrWhiteSpace($Env:ASPNETCORE_URLS)) {
    $Env:ASPNETCORE_URLS = $Env:HELIX_API_URL
}
if (-not $Env:ASPNETCORE_ENVIRONMENT -or [string]::IsNullOrWhiteSpace($Env:ASPNETCORE_ENVIRONMENT)) {
    $Env:ASPNETCORE_ENVIRONMENT = "Development"
}
if (-not $Env:HELIX_WEB_URL -or [string]::IsNullOrWhiteSpace($Env:HELIX_WEB_URL)) {
    $Env:HELIX_WEB_URL = "http://localhost:3000"
}
if (-not $Env:HELIX_WEB_PORT -or [string]::IsNullOrWhiteSpace($Env:HELIX_WEB_PORT)) {
    $Env:HELIX_WEB_PORT = "3000"
}
if (-not $Env:HELIX_KAFKA_BOOTSTRAP_SERVERS -or [string]::IsNullOrWhiteSpace($Env:HELIX_KAFKA_BOOTSTRAP_SERVERS)) {
    $Env:HELIX_KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
}
if (-not $Env:HELIX_RABBITMQ_HOST -or [string]::IsNullOrWhiteSpace($Env:HELIX_RABBITMQ_HOST)) {
    $Env:HELIX_RABBITMQ_HOST = "localhost"
}
if (-not $Env:HELIX_RABBITMQ_PORT -or [string]::IsNullOrWhiteSpace($Env:HELIX_RABBITMQ_PORT)) {
    $Env:HELIX_RABBITMQ_PORT = "5672"
}
if (-not $Env:HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE -or [string]::IsNullOrWhiteSpace($Env:HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE)) {
    $Env:HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE = "portfolio.recompute"
}
if (-not $Env:HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE -or [string]::IsNullOrWhiteSpace($Env:HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE)) {
    $Env:HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE = "trade.compute"
}
if (-not $Env:HELIX_RABBITMQ_MANAGEMENT_URL -or [string]::IsNullOrWhiteSpace($Env:HELIX_RABBITMQ_MANAGEMENT_URL)) {
    $Env:HELIX_RABBITMQ_MANAGEMENT_URL = "http://localhost:15672"
}
if (-not $Env:HELIX_JAVA_HOME -or [string]::IsNullOrWhiteSpace($Env:HELIX_JAVA_HOME)) {
    $Env:HELIX_JAVA_HOME = "/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
}
if (-not $Env:HELIX_KAFKA_UI_PORT -or [string]::IsNullOrWhiteSpace($Env:HELIX_KAFKA_UI_PORT)) {
    $Env:HELIX_KAFKA_UI_PORT = "8080"
}
if (-not $Env:HELIX_KAFKA_UI_URL -or [string]::IsNullOrWhiteSpace($Env:HELIX_KAFKA_UI_URL)) {
    $Env:HELIX_KAFKA_UI_URL = "http://localhost:$Env:HELIX_KAFKA_UI_PORT"
}
if (-not $Env:HELIX_KAFKA_UI_DIR -or [string]::IsNullOrWhiteSpace($Env:HELIX_KAFKA_UI_DIR)) {
    $Env:HELIX_KAFKA_UI_DIR = Join-Path $RepoRoot "tools/kafka-ui"
}
if (-not $Env:HELIX_KAFKA_UI_JAR -or [string]::IsNullOrWhiteSpace($Env:HELIX_KAFKA_UI_JAR)) {
    $Env:HELIX_KAFKA_UI_JAR = Join-Path $Env:HELIX_KAFKA_UI_DIR "kafka-ui-api.jar"
}
if (-not $Env:HELIX_KAFKA_UI_PID_FILE -or [string]::IsNullOrWhiteSpace($Env:HELIX_KAFKA_UI_PID_FILE)) {
    $Env:HELIX_KAFKA_UI_PID_FILE = Join-Path $Env:HELIX_KAFKA_UI_DIR "kafka-ui.pid"
}
if (-not $Env:HELIX_KAFKA_UI_LOG_FILE -or [string]::IsNullOrWhiteSpace($Env:HELIX_KAFKA_UI_LOG_FILE)) {
    $Env:HELIX_KAFKA_UI_LOG_FILE = Join-Path $Env:HELIX_KAFKA_UI_DIR "kafka-ui.log"
}
if (Test-Path $Env:HELIX_JAVA_HOME) {
    $Env:JAVA_HOME = $Env:HELIX_JAVA_HOME
    if ($Env:PATH -notlike "$Env:JAVA_HOME/bin*") {
        $Env:PATH = "$Env:JAVA_HOME/bin;$Env:PATH"
    }
}

Write-Host "[env] HELIX_DB_PATH=$Env:HELIX_DB_PATH"
Write-Host "[env] HELIX_API_URL=$Env:HELIX_API_URL"
Write-Host "[env] ASPNETCORE_URLS=$Env:ASPNETCORE_URLS"
Write-Host "[env] ASPNETCORE_ENVIRONMENT=$Env:ASPNETCORE_ENVIRONMENT"
Write-Host "[env] HELIX_WEB_URL=$Env:HELIX_WEB_URL"
Write-Host "[env] HELIX_WEB_PORT=$Env:HELIX_WEB_PORT"
Write-Host "[env] HELIX_KAFKA_BOOTSTRAP_SERVERS=$Env:HELIX_KAFKA_BOOTSTRAP_SERVERS"
Write-Host "[env] HELIX_RABBITMQ_HOST=$Env:HELIX_RABBITMQ_HOST"
Write-Host "[env] HELIX_RABBITMQ_PORT=$Env:HELIX_RABBITMQ_PORT"
Write-Host "[env] HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE=$Env:HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE"
Write-Host "[env] HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE=$Env:HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE"
Write-Host "[env] HELIX_RABBITMQ_MANAGEMENT_URL=$Env:HELIX_RABBITMQ_MANAGEMENT_URL"
Write-Host "[env] HELIX_JAVA_HOME=$Env:HELIX_JAVA_HOME"
Write-Host "[env] HELIX_KAFKA_UI_URL=$Env:HELIX_KAFKA_UI_URL"
Write-Host "[env] HELIX_KAFKA_UI_JAR=$Env:HELIX_KAFKA_UI_JAR"
if (Get-Command dotnet -ErrorAction SilentlyContinue) {
    Write-Host "[env] DOTNET_BIN=$((Get-Command dotnet).Source)"
    Write-Host "[env] DOTNET_SDK=$(dotnet --version)"
}
