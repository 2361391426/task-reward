$ErrorActionPreference = 'Stop'

$backendRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $backendRoot 'dist-scf'
$stageDir = Join-Path $outputDir ('package-' + (Get-Date -Format 'yyyyMMddHHmmss'))
$zipPath = Join-Path $outputDir 'taskreward-scf.zip'

if (!(Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stageDir | Out-Null

Copy-Item -LiteralPath (Join-Path $backendRoot 'package.json') -Destination $stageDir

$scfEnvPath = Join-Path $backendRoot '.env.scf'
if (Test-Path -LiteralPath $scfEnvPath) {
    Copy-Item -LiteralPath $scfEnvPath -Destination (Join-Path $stageDir '.env')
    Write-Host 'Included local .env.scf as .env for SCF fallback.'
}

$esbuildBin = Join-Path $backendRoot 'node_modules\.bin\esbuild.cmd'
if (!(Test-Path -LiteralPath $esbuildBin)) {
    throw "esbuild not found: $esbuildBin"
}

$bundlePath = Join-Path $stageDir 'scf-server.js'
& $esbuildBin `
    (Join-Path $backendRoot 'scf-server.js') `
    --bundle `
    --platform=node `
    --target=node12 `
    --format=cjs `
    "--outfile=$bundlePath"

if ($LASTEXITCODE -ne 0) {
    throw "esbuild failed with exit code $LASTEXITCODE"
}

$bootstrapPath = Join-Path $stageDir 'scf_bootstrap'
$bootstrapContent = @(
    '#!/bin/bash'
    'export PORT=9000'
    '/var/lang/node12/bin/node scf-server.js'
)
[System.IO.File]::WriteAllText($bootstrapPath, ($bootstrapContent -join "`n") + "`n", [System.Text.Encoding]::ASCII)

Push-Location $stageDir
try {
    tar.exe -a -c -f $zipPath *
    if ($LASTEXITCODE -ne 0) {
        throw "zip failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

Write-Host "SCF package created: $zipPath"
Write-Host 'Upload this zip directly. It includes scf_bootstrap and listens on port 9000.'
