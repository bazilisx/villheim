# Keeps the test profile on the latest commit of main. Leave it running in a PowerShell window while you play.
# Every few seconds it checks GitHub. When main has a new commit it pulls, builds and copies the DLLs into the
# profile, then prints the commit. Logic changes reload in the running game within a few seconds; when the core
# changed too it says so, and the game needs a restart.
#
# Usage (from the repo root):
#   ./scripts/watch.ps1                      # Villheim Test profile, checks every 20 seconds
#   ./scripts/watch.ps1 -Seconds 10 -Profile "My Test"
#
# Use a clone you don't edit by hand: it pulls with --ff-only and stops if the pull can't fast-forward.
param(
    [string]$Profile = "Villheim Test",
    [int]$Seconds = 20
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Deploy([string]$from, [string]$to) {
    $coreChanged = $false
    if ($from) {
        $changed = git diff --name-only $from $to -- src/Villheim src/Directory.Build.props
        $coreChanged = [bool]$changed
    }

    if ($coreChanged) {
        & "$PSScriptRoot\deploy.ps1" -Profile $Profile -Core
    } else {
        & "$PSScriptRoot\deploy.ps1" -Profile $Profile
    }

    $subject = git log -1 --format=%s $to
    $short = git rev-parse --short=7 $to
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] Deployed $short  $subject" -ForegroundColor Green
    if ($coreChanged) {
        Write-Host "           The core changed: restart Valheim to load it." -ForegroundColor Yellow
    } else {
        Write-Host "           In game, the hearth's hover text and 'vh version' should show commit-$short." -ForegroundColor Green
    }
}

Write-Host "Watching origin/main every $Seconds s for profile '$Profile'. Ctrl+C to stop."
git fetch origin main -q
git pull --ff-only origin main -q
Deploy $null (git rev-parse HEAD)

while ($true) {
    Start-Sleep -Seconds $Seconds
    try {
        git fetch origin main -q
        $local = git rev-parse HEAD
        $remote = git rev-parse origin/main
        if ($local -ne $remote) {
            git pull --ff-only origin main -q
            if ($LASTEXITCODE -ne 0) { throw "git pull could not fast-forward; is this clone edited by hand?" }
            Deploy $local $remote
        }
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $_" -ForegroundColor Red
    }
}
