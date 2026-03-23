<#
  Build helix-rest and helix-web production artifacts without starting the stack.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$EnvScript = Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

Push-Location $RepoRoot

Write-Host "[build] Building helix-rest production publish..."
& (Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "rest_build.ps1")

Write-Host "[build] Building helix-web production bundle..."
& (Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) "tex/windows") "web_build.ps1")

Write-Host "[build] Done."

Pop-Location
