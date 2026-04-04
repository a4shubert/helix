<#
  Book sample trades directly into Helix and queue runtime processing.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$RuntimeDir = Join-Path $RepoRoot "helix-runtime"
$PythonScript = Join-Path (Join-Path (Split-Path -Parent $ScriptDir) "linux") "trades.py"

$EnvScript = Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

$PythonBin = Join-Path $RuntimeDir ".venv/Scripts/python.exe"
if (-not (Test-Path $PythonBin)) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $PythonBin = (Get-Command python).Source
    } else {
        Write-Host "[trades] Python not found. Create the runtime environment first."
        exit 1
    }
}

Push-Location $RepoRoot
$Env:PYTHONPATH = "$RepoRoot/helix-core/src;$RepoRoot/helix-runtime/src"
& $PythonBin $PythonScript @args
$exitCode = $LASTEXITCODE
Pop-Location
exit $exitCode
