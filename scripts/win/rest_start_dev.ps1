<#
  Run the app in Development using the launch profile "HelixRest".
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ProjectDir = Join-Path $RepoRoot "helix-rest/HelixRest"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

$port = ([System.Uri]$Env:ASPNETCORE_URLS.Split(';')[0]).Port
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[rest_start_dev] Port $port is already in use."
    exit 1
}

Push-Location $ProjectDir
$Env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --launch-profile "HelixRest"
Pop-Location
