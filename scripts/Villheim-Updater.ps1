# Villheim updater
#
# Keeps the "Villheim Test" r2modman profile on the newest Villheim build. Every push to main makes GitHub build the
# mod and post the files as the "Latest test build" release. This script checks that release every 20 seconds and
# copies anything new into the profile's plugin folder. Nothing else is needed on the PC: no Git, no .NET.
#
# How to run it (Windows):
#   1. Press the Windows key, type PowerShell, press Enter.
#   2. Paste this line and press Enter:
#        irm https://raw.githubusercontent.com/bazilisx/villheim/main/scripts/Villheim-Updater.ps1 | iex
#   3. Leave the window open while you play. Close it when you are done.
#
# Logic updates load into the running game within a few seconds. When the core DLL changes, Windows won't let it be
# replaced while Valheim runs; the window then says to close Valheim and finishes the copy by itself.
#
# Another profile: set $env:VILLHEIM_PROFILE = "Profile Name" in the window before pasting the line.

$updaterVersion = 4
$updaterUrl = "https://raw.githubusercontent.com/bazilisx/villheim/main/scripts/Villheim-Updater.ps1"

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$profileName = if ($env:VILLHEIM_PROFILE) { $env:VILLHEIM_PROFILE } else { "Villheim Test" }
$checkEvery = 20
$release = "https://github.com/bazilisx/villheim/releases/download/dev-latest"
$profiles = Join-Path $env:APPDATA "r2modmanPlus-local\Valheim\profiles"
$profileFolder = Join-Path $profiles $profileName
$plugin = Join-Path $profileFolder "BepInEx\plugins\bazilisx-Villheim"
$download = Join-Path $env:TEMP "villheim-update"
$marker = Join-Path $plugin "villheim-build.txt"
$engineFiles = @("Jint.dll", "Acornima.dll", "System.Runtime.CompilerServices.Unsafe.dll")

function Say([string]$text, [string]$color = "Gray") {
    Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $text) -ForegroundColor $color
}

function Same-File([string]$a, [string]$b) {
    if (-not (Test-Path $a) -or -not (Test-Path $b)) { return $false }
    return (Get-FileHash $a).Hash -eq (Get-FileHash $b).Hash
}

function Fetch([string]$name) {
    $target = Join-Path $download $name
    Invoke-WebRequest -Uri ("{0}/{1}?t={2}" -f $release, $name, [DateTime]::UtcNow.Ticks) -OutFile $target -UseBasicParsing
    return $target
}

if (-not (Test-Path $profileFolder)) {
    Say "Can't find the r2modman profile '$profileName' in $profiles" Red
    if (Test-Path $profiles) {
        Say "Profiles found there:" Yellow
        Get-ChildItem $profiles -Directory | ForEach-Object { Say ("  " + $_.Name) Yellow }
    }
    Say "Set the right name with: `$env:VILLHEIM_PROFILE = `"Profile Name`" and run the line again." Yellow
    return
}

New-Item -ItemType Directory -Force -Path $plugin, $download | Out-Null
$installed = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { "" }
$coreWaiting = $false
$coreWarned = $false

Say "Watching for new Villheim builds for profile '$profileName'. Leave this window open; close it to stop." Cyan
if ($installed) { Say "Installed now: commit $installed" }

while ($true) {
    # A newer copy of this script on main replaces this one in the same window.
    try {
        $script = Invoke-RestMethod -Uri ("{0}?t={1}" -f $updaterUrl, [DateTime]::UtcNow.Ticks) -UseBasicParsing
        if ($script -match '\$updaterVersion = (\d+)' -and [int]$Matches[1] -gt $updaterVersion) {
            Say ("The updater itself changed (version {0}). Restarting it." -f $Matches[1]) Cyan
            Invoke-Expression $script
            return
        }
    } catch { }

    try {
        $latest = (Get-Content (Fetch "version.txt") -Raw).Trim()
        if ($latest -and $latest -ne $installed) {
            Say "New build $latest found. Downloading..."
            $logicDll = Fetch "Villheim.Logic.dll"
            $logicPdb = Fetch "Villheim.Logic.pdb"
            $coreDll = Fetch "Villheim.dll"
            $corePdb = Fetch "Villheim.pdb"
            # The JavaScript engine for 'vh gen'. Like the core, Windows locks these once the game has loaded them.
            foreach ($name in $engineFiles) {
                try { Fetch $name | Out-Null } catch { Say "$name is not in this build." DarkYellow }
            }

            # The pdb first: the game reloads as soon as the logic DLL changes.
            Copy-Item $logicPdb $plugin -Force
            Copy-Item $logicDll $plugin -Force
            $installed = $latest
            Set-Content -Path $marker -Value $latest
            $coreWaiting = -not (Same-File $coreDll (Join-Path $plugin "Villheim.dll"))
            foreach ($name in $engineFiles) {
                $new = Join-Path $download $name
                if ((Test-Path $new) -and -not (Same-File $new (Join-Path $plugin $name))) {
                    try { Copy-Item $new $plugin -Force } catch { $coreWaiting = $true }
                }
            }
            $coreWarned = $false
            Say "Installed build $latest. In game, the hearth's hover text should end in commit-$latest." Green
        }

        if ($coreWaiting) {
            try {
                Copy-Item (Join-Path $download "Villheim.dll") $plugin -Force
                Copy-Item (Join-Path $download "Villheim.pdb") $plugin -Force
                foreach ($name in $engineFiles) {
                    $new = Join-Path $download $name
                    if (Test-Path $new) { Copy-Item $new $plugin -Force }
                }
                $coreWaiting = $false
                Say "Core updated too. Start (or restart) Valheim to load it." Green
            } catch {
                if (-not $coreWarned) {
                    Say "The core file (or the generator's Jint files) needs replacing too, which can't happen while Valheim runs. Everything else is" Yellow
                    Say "already loaded. Next time you close Valheim this window finishes the swap by itself." Yellow
                    $coreWarned = $true
                }
            }
        }
    } catch {
        Say "Couldn't check for a new build ($($_.Exception.Message)). Trying again shortly." DarkYellow
    }

    Start-Sleep -Seconds $checkEvery
}
