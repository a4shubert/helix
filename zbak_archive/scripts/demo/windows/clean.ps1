<#
  Reset the Helix SQLite store to clean seeded state.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$EnvScript = Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[clean] python not found."
    exit 1
}

Write-Host "[clean] Resetting SQLite store at $Env:HELIX_DB_PATH"
python (Join-Path $RepoRoot "helix-store/init_clean_state.py")
Write-Host "[clean] Clean state ready."
