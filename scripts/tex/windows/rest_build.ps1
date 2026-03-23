<#
  Production build helper for HelixRest.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$ProjectPath = Join-Path $RepoRoot "helix-rest/HelixRest/HelixRest.csproj"
$PublishDir = Join-Path $RepoRoot "helix-rest/publish"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

Push-Location $RepoRoot

Write-Host "[rest_build] Cleaning..."
dotnet clean $ProjectPath

Write-Host "[rest_build] Restoring packages..."
dotnet restore $ProjectPath

Write-Host "[rest_build] Publishing Release build..."
dotnet publish $ProjectPath -c Release -o $PublishDir

Write-Host "[rest_build] Done. To run:"
Write-Host "  cd $PublishDir"
Write-Host "  HELIX_DB_PATH=$Env:HELIX_DB_PATH ASPNETCORE_ENVIRONMENT=$Env:ASPNETCORE_ENVIRONMENT dotnet HelixRest.dll"

Pop-Location
