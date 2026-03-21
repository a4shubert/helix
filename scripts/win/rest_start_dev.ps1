<#
  Run the app in Development using the launch profile "HelixRest".
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ProjectDir = Join-Path $RepoRoot "helix-rest/HelixRest"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

Push-Location $ProjectDir
$Env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --launch-profile "HelixRest"
Pop-Location
