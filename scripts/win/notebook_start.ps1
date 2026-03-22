<#
  Start Jupyter Notebook for Helix platform notebooks using the runtime environment.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$RuntimeDir = Join-Path $RepoRoot "helix-runtime"
$NotebookDir = Join-Path $RepoRoot "notebooks"

$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

$PythonBin = Join-Path $RuntimeDir ".venv/Scripts/python.exe"
$JupyterBin = Join-Path $RuntimeDir ".venv/Scripts/jupyter.exe"

if (-not (Test-Path $PythonBin) -or -not (Test-Path $JupyterBin)) {
    Write-Host "[notebook_start] Runtime Jupyter environment not found."
    Write-Host "[notebook_start] Run ./scripts/win/python_kernels_setup.ps1 first."
    exit 1
}

New-Item -ItemType Directory -Force -Path $NotebookDir | Out-Null

$kernels = & $JupyterBin kernelspec list 2>$null
if ($kernels -notmatch "helix-runtime") {
    Write-Host "[notebook_start] Registering Helix Runtime Jupyter kernel..."
    & $PythonBin -m ipykernel install --user --name helix-runtime --display-name "Helix Runtime"
}

Write-Host "[notebook_start] Starting Jupyter Notebook in $NotebookDir"
Push-Location $RepoRoot
$Env:PYTHONPATH = "$RepoRoot/helix-core/src;$RepoRoot/helix-runtime/src"
& $JupyterBin notebook $NotebookDir
Pop-Location
