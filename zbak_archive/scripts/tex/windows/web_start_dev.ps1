<#
  Start the Next.js dev server for the Helix web UI.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$WebDir = Join-Path $RepoRoot "helix-web"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[web_start_dev] npm not found. Please install Node.js/npm first."
    exit 1
}

if (-not (Test-Path $WebDir)) {
    Write-Host "[web_start_dev] $WebDir not found. Did you clone the repo?"
    exit 1
}

$existing = Get-NetTCPConnection -LocalPort ([int]$Env:HELIX_WEB_PORT) -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[web_start_dev] Port $Env:HELIX_WEB_PORT is already in use."
    exit 1
}

Push-Location $WebDir
if (-not (Test-Path "node_modules")) {
    Write-Host "[web_start_dev] Installing dependencies..."
    npm install
}

Write-Host "[web_start_dev] Starting Next.js dev server on port $Env:HELIX_WEB_PORT..."
npm run dev -- --port $Env:HELIX_WEB_PORT
Pop-Location
