# Builds Villheim and copies it into an r2modman profile.
# Usage (PowerShell, from the repo root):
#   ./scripts/deploy.ps1                      # logic only: hot reloads while Valheim is running
#   ./scripts/deploy.ps1 -Core                # core too: restart Valheim afterwards
#   ./scripts/deploy.ps1 -Profile "My Test"   # a different r2modman profile
param(
    [string]$Profile = "Villheim Test",
    [switch]$Core
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$target = Join-Path $env:APPDATA "r2modmanPlus-local\Valheim\profiles\$Profile\BepInEx\plugins\bazilisx-Villheim"
New-Item -ItemType Directory -Force -Path $target | Out-Null

dotnet build "$repo\Villheim.sln" -c Debug -nologo -v q
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

$logic = "$repo\src\Villheim.Logic\bin\Debug"
Copy-Item "$logic\Villheim.Logic.pdb" $target -Force
# Copy the DLL last: the core reloads as soon as the DLL changes and settles.
Copy-Item "$logic\Villheim.Logic.dll" $target -Force

if ($Core) {
    Copy-Item "$repo\src\Villheim\bin\Debug\Villheim.dll" $target -Force
    Copy-Item "$repo\src\Villheim\bin\Debug\Villheim.pdb" $target -Force
    Write-Host "Core updated: restart Valheim to load it."
}

Write-Host "Deployed to $target"
