<#
  Start the combined Helix runtime service.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$RuntimeDir = Join-Path $RepoRoot "helix-runtime"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

$PythonBin = Join-Path $RuntimeDir ".venv/Scripts/python.exe"
if (-not (Test-Path $PythonBin)) {
    $PythonBin = "python"
}

Write-Host "[runtime_start] Starting helix-runtime service..."
Push-Location $RepoRoot
$Env:PYTHONPATH = "$RepoRoot/helix-core/src;$RepoRoot/helix-runtime/src"
& $PythonBin -m helix_runtime.cli run-service --db-path $Env:HELIX_DB_PATH
Pop-Location
