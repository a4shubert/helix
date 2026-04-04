<#
  Render README.md to README.pdf using pandoc + Prince.
#>

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$ReadmeMd = Join-Path $RepoRoot "README.md"
$ReadmePdf = Join-Path $RepoRoot "README.pdf"

if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) {
    Write-Host "[readme_pdf] pandoc not found."
    exit 1
}

if (-not (Get-Command prince -ErrorAction SilentlyContinue)) {
    Write-Host "[readme_pdf] prince not found."
    exit 1
}

$TempHtml = Join-Path $RepoRoot (".helix-readme-" + [System.Guid]::NewGuid().ToString("N") + ".html")

try {
    Push-Location $RepoRoot

    pandoc `
        $ReadmeMd `
        --from gfm `
        --standalone `
        --toc `
        --metadata title="Helix README" `
        --resource-path=$RepoRoot `
        -o $TempHtml

    prince $TempHtml -o $ReadmePdf

    Write-Host "[readme_pdf] Wrote $ReadmePdf"
}
finally {
    Pop-Location
    if (Test-Path $TempHtml) {
        Remove-Item $TempHtml -Force
    }
}
