<#
  Clear live snapshots and rebuild them by replaying all trades through RabbitMQ tasks.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$RuntimeDir = Join-Path $RepoRoot "helix-runtime"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

$PythonBin = Join-Path $RuntimeDir ".venv/Scripts/python.exe"
if (-not (Test-Path $PythonBin)) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $PythonBin = (Get-Command python).Source
    } else {
        Write-Host "[runtime_replay_trades] Python not found. Create the runtime environment first."
        exit 1
    }
}

Write-Host "[runtime_replay_trades] Replaying all trades through RabbitMQ tasks..."
Push-Location $RepoRoot
$Env:PYTHONPATH = "$RepoRoot/helix-core/src;$RepoRoot/helix-runtime/src"
& $PythonBin -m helix_runtime.cli replay-trades --db-path $Env:HELIX_DB_PATH @args
$exitCode = $LASTEXITCODE
Pop-Location
exit $exitCode
