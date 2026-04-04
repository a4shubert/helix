$ErrorActionPreference = "Stop"

$Port = 3001
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\..\.."))
$WebDir = Join-Path $RepoRoot "web"

if (-not (Test-Path -Path $WebDir -PathType Container)) {
    Write-Error "web directory not found: $WebDir"
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is required but was not found on PATH."
}

$PortProcesses = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

if ($PortProcesses) {
    Write-Host "Stopping process(es) on port $Port: $($PortProcesses -join ', ')"
    $PortProcesses | ForEach-Object {
        Stop-Process -Id $_ -Force
    }
}

Set-Location $WebDir
npm run dev
