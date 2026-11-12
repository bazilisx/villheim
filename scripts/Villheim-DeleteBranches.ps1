# Deletes branches of github.com/bazilisx/villheim that main already holds, plus any extra branches named with -Extra.
# Cloud sessions cannot delete branches (their git connection answers HTTP 403), so this runs on Tyler's PC with his
# own Git login. It never deletes main or any branch named with -Keep.
#
# Run in PowerShell:
#   cd "$env:USERPROFILE\Downloads"
#   powershell -ExecutionPolicy Bypass -File .\Villheim-DeleteBranches.ps1
# Options:
#   -Extra "feat/old","wip/x"   also delete these (branches judged superseded though not merged)
#   -Keep "wip/shell-open-edge-rails"   never delete these
#   -Yes                        delete without asking (a session uses this only after Tyler's yes in chat)
#   -DryRun                     list what would be deleted and stop
# Needs Git for Windows. Git asks for a GitHub sign-in the first time if it has no saved login.
param(
    [string[]]$Extra = @(),
    [string[]]$Keep = @(),
    [switch]$Yes,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repo = "https://github.com/bazilisx/villheim.git"
$keepAll = @("main") + $Keep

$tmp = Join-Path $env:TEMP "villheim-branch-cleanup"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
Write-Host "Reading the repo's branches (no files are downloaded)..."
git clone -q --bare --filter=blob:none $repo $tmp
Set-Location $tmp

$merged = git branch --format="%(refname:short)" --merged main | ForEach-Object { $_.Trim() }
$all = git branch --format="%(refname:short)" | ForEach-Object { $_.Trim() }
$targets = @($merged + ($Extra | Where-Object { $all -contains $_ })) | Sort-Object -Unique |
    Where-Object { $keepAll -notcontains $_ }
$missing = $Extra | Where-Object { $all -notcontains $_ }

if ($missing) { Write-Host "Not on GitHub (skipped): $($missing -join ', ')" }
if (-not $targets) { Write-Host "Nothing to delete. Branches on GitHub:"; $all; exit 0 }

Write-Host ""
Write-Host "Will delete $($targets.Count) branches:"
$targets | ForEach-Object { Write-Host "  $_" }
Write-Host "Keeping: $((($all | Where-Object { $targets -notcontains $_ }) -join ', '))"
if ($DryRun) { exit 0 }
if (-not $Yes) {
    $answer = Read-Host "Delete them? Type yes"
    if ($answer -ne "yes") { Write-Host "Nothing deleted."; exit 0 }
}

git push $repo --delete @targets
Write-Host ""
Write-Host "Done. Branches left on GitHub:"
git ls-remote --heads $repo
