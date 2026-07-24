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
$buildSha = 'local'
try {
    $gitSha = git -C $backendRoot rev-parse --short HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and ![string]::IsNullOrWhiteSpace($gitSha)) {
        $buildSha = $gitSha.Trim()
    }
} catch {
    $buildSha = 'local'
}
$bannerContent = @'
const __taskRewardModule = require("module");
const __taskRewardCrypto = require("crypto");
const __taskRewardFs = require("fs");
const __taskRewardStream = require("stream");
const __taskRewardUtil = require("util");
const __taskRewardLoad = __taskRewardModule._load;
__taskRewardModule._load = function patchedTaskRewardLoad(request, parent, isMain) {
  if (typeof request === "string" && request.indexOf("node:") === 0) {
    request = request.slice(5);
  }
  if (request === "fs/promises") {
    return __taskRewardFs.promises;
  }
  if (request === "stream/promises") {
    return {
      pipeline: __taskRewardUtil.promisify(__taskRewardStream.pipeline),
      finished: __taskRewardUtil.promisify(__taskRewardStream.finished)
    };
  }
  if (request === "timers/promises") {
    return {
      setTimeout: function taskRewardDelay(ms, value) {
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(value); }, ms);
        });
      },
      setImmediate: function taskRewardImmediate(value) {
        return new Promise(function(resolve) {
          setImmediate(function() { resolve(value); });
        });
      }
    };
  }
  return __taskRewardLoad.call(this, request, parent, isMain);
};
if (!__taskRewardCrypto.randomUUID) {
  __taskRewardCrypto.randomUUID = function randomUUID() {
    const bytes = __taskRewardCrypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}
'@
$buildBanner = "process.env.TASK_REWARD_BUILD_SHA = process.env.TASK_REWARD_BUILD_SHA || '$buildSha';`n"
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

$bundleContent = [System.IO.File]::ReadAllText($bundlePath, [System.Text.Encoding]::UTF8)
$bundleContent = $bundleContent.Replace('require("fs/promises")', 'require("fs").promises')
[System.IO.File]::WriteAllText($bundlePath, $buildBanner + $bannerContent + "`n" + $bundleContent, [System.Text.Encoding]::UTF8)

$bootstrapPath = Join-Path $stageDir 'scf_bootstrap'
$bootstrapContent = @(
    '#!/bin/bash'
    'set -eu'
    'export PORT=9000'
    'if [ -x /var/lang/node18/bin/node ]; then'
    '  NODE_BIN=/var/lang/node18/bin/node'
    'elif [ -x /var/lang/node12/bin/node ]; then'
    '  NODE_BIN=/var/lang/node12/bin/node'
    'else'
    '  echo Node.js runtime not found >&2'
    '  exit 1'
    'fi'
    'exec $NODE_BIN scf-server.js'
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
