<#
  Common environment setup for Windows/PowerShell Helix runs.
#>

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

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
    $Env:ASPNETCORE_ENVIRONMENT = "Production"
}
if (-not $Env:HELIX_WEB_URL -or [string]::IsNullOrWhiteSpace($Env:HELIX_WEB_URL)) {
    $Env:HELIX_WEB_URL = "http://localhost:3001"
}
if (-not $Env:HELIX_WEB_PORT -or [string]::IsNullOrWhiteSpace($Env:HELIX_WEB_PORT)) {
    $Env:HELIX_WEB_PORT = "3001"
}

Write-Host "[env] HELIX_DB_PATH=$Env:HELIX_DB_PATH"
Write-Host "[env] HELIX_API_URL=$Env:HELIX_API_URL"
Write-Host "[env] ASPNETCORE_URLS=$Env:ASPNETCORE_URLS"
Write-Host "[env] ASPNETCORE_ENVIRONMENT=$Env:ASPNETCORE_ENVIRONMENT"
Write-Host "[env] HELIX_WEB_URL=$Env:HELIX_WEB_URL"
Write-Host "[env] HELIX_WEB_PORT=$Env:HELIX_WEB_PORT"
