<#
  Create Helix Python virtual environments and register Jupyter kernels.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$CoreDir = Join-Path $RepoRoot "helix-core"
$RuntimeDir = Join-Path $RepoRoot "helix-runtime"

if (-not $Env:PYTHON_BIN -or [string]::IsNullOrWhiteSpace($Env:PYTHON_BIN)) {
    $Env:PYTHON_BIN = "python"
}

if (-not (Get-Command $Env:PYTHON_BIN -ErrorAction SilentlyContinue)) {
    Write-Host "[python_kernels_setup] $Env:PYTHON_BIN not found."
    exit 1
}

Write-Host "[python_kernels_setup] Creating helix-core virtualenv..."
& $Env:PYTHON_BIN -m venv (Join-Path $CoreDir ".venv")
& (Join-Path $CoreDir ".venv/Scripts/python.exe") -m pip install --upgrade pip
& (Join-Path $CoreDir ".venv/Scripts/python.exe") -m pip install -e $CoreDir ipykernel
& (Join-Path $CoreDir ".venv/Scripts/python.exe") -m ipykernel install --user --name helix-core --display-name "Helix Core"

Write-Host "[python_kernels_setup] Creating helix-runtime virtualenv..."
& $Env:PYTHON_BIN -m venv (Join-Path $RuntimeDir ".venv")
& (Join-Path $RuntimeDir ".venv/Scripts/python.exe") -m pip install --upgrade pip
& (Join-Path $RuntimeDir ".venv/Scripts/python.exe") -m pip install -e $CoreDir -e $RuntimeDir ipykernel
& (Join-Path $RuntimeDir ".venv/Scripts/python.exe") -m ipykernel install --user --name helix-runtime --display-name "Helix Runtime"

Write-Host "[python_kernels_setup] Registered kernels:"
jupyter kernelspec list
