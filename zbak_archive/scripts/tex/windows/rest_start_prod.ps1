<#
  Run the published Release build of HelixRest on Windows.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$PublishDir = Join-Path $RepoRoot "helix-rest/publish"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

$port = ([System.Uri]$Env:ASPNETCORE_URLS.Split(';')[0]).Port
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[rest_start_prod] Port $port is already in use."
    exit 1
}

if (-not (Test-Path $PublishDir)) {
    Write-Host "[rest_start_prod] publish directory not found at $PublishDir. Run scripts/tex/windows/rest_build.ps1 first."
    exit 1
}

Push-Location $PublishDir
dotnet HelixRest.dll
Pop-Location
