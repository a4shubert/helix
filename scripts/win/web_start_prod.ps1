<#
  Run the Next.js production server (requires prior web_build).
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$WebDir = Join-Path $RepoRoot "helix-web"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[web_start_prod] npm not found. Please install Node.js/npm first."
    exit 1
}

if (-not (Test-Path $WebDir)) {
    Write-Host "[web_start_prod] $WebDir not found. Did you clone the repo?"
    exit 1
}

Push-Location $WebDir
if (-not (Test-Path "node_modules")) {
    Write-Host "[web_start_prod] Installing dependencies..."
    npm install
}

if (-not (Test-Path ".next")) {
    if ($Env:HELIX_WEB_REBUILD -eq "1") {
        Write-Host "[web_start_prod] .next not found. Running build (HELIX_WEB_REBUILD=1)..."
        npm run build
    } else {
        Write-Host "[web_start_prod] .next not found. Run scripts/win/web_build.ps1 first."
        Write-Host "[web_start_prod] Or set HELIX_WEB_REBUILD=1 to build automatically."
        exit 1
    }
}

Write-Host "[web_start_prod] Starting Next.js production server on port $Env:HELIX_WEB_PORT..."
npm run start -- --port $Env:HELIX_WEB_PORT
Pop-Location
