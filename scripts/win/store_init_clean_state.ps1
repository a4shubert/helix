<#
  Reset the Helix SQLite store to clean seeded state.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[store_init_clean_state] python not found."
    exit 1
}

Write-Host "[store_init_clean_state] Resetting SQLite store at $Env:HELIX_DB_PATH"
python (Join-Path $RepoRoot "helix-store/init_clean_state.py")
Write-Host "[store_init_clean_state] Clean state ready."
