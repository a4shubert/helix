<#
  Install Helix project dependencies for Windows/PowerShell.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[install] python not found."
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[install] npm not found."
    exit 1
}
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host "[install] dotnet not found."
    exit 1
}

if (Get-Command brew -ErrorAction SilentlyContinue) {
    Write-Host "[install] Ensuring broker prerequisites are installed with Homebrew..."
    brew install kafka rabbitmq openjdk
}

Write-Host "[install] Restoring helix-rest..."
Push-Location (Join-Path $RepoRoot "helix-rest")
dotnet restore helix.sln
Pop-Location

Write-Host "[install] Installing helix-web dependencies..."
Push-Location (Join-Path $RepoRoot "helix-web")
npm install
Pop-Location

$CoreVenv = Join-Path $RepoRoot "helix-core/.venv"
$RuntimeVenv = Join-Path $RepoRoot "helix-runtime/.venv"

Write-Host "[install] Creating helix-core virtual environment..."
python -m venv $CoreVenv
& (Join-Path $CoreVenv "Scripts/python.exe") -m pip install --upgrade pip
& (Join-Path $CoreVenv "Scripts/python.exe") -m pip install -e (Join-Path $RepoRoot "helix-core")

Write-Host "[install] Creating helix-runtime virtual environment..."
python -m venv $RuntimeVenv
& (Join-Path $RuntimeVenv "Scripts/python.exe") -m pip install --upgrade pip
& (Join-Path $RuntimeVenv "Scripts/python.exe") -m pip install -e (Join-Path $RepoRoot "helix-core")
& (Join-Path $RuntimeVenv "Scripts/python.exe") -m pip install -e "$RepoRoot/helix-runtime[brokers]"

Write-Host "[install] Helix installation complete."
