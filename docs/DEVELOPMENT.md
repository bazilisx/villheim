# Development and testing

Standing reference for building, deploying and testing Villheim. Current state is in `SESSION_HISTORY.md`.

## Building

- .NET SDK 8 builds the `net48` projects. No Valheim install is needed: the game assemblies come from the
  `Digitalroot.Valheim.Common.References` NuGet package (publicized, stubbed copies of Valheim 1.0.21).
- `dotnet build Villheim.sln -c Release` builds both assemblies. `scripts/build-dev.sh <dir>` builds Debug and
  collects the four files (`Villheim.dll/.pdb`, `Villheim.Logic.dll/.pdb`) into one folder.
- Both projects set `AllowUnsafeBlocks`. Unity's Mono enforces access checks, and this flag emits the
  SkipVerification attribute that lets the mod use the publicized (private) game members at runtime. Without it the
  game throws `FieldAccessException` / `MethodAccessException`.
- GitHub Actions (`.github/workflows/build.yml`) builds on every push and uploads a `Villheim` artifact.
- Cloud containers may block `nuget.bepinex.dev`, which is the only source of `BepInEx.Core` and
  `UnityEngine.Modules` 6000. `scripts/build-cloud.sh` is a compile check that uses nuget.org, the BepInEx GitHub
  release and `UnityEngine.Modules` 2021.3 instead. Install the SDK with `apt-get install -y dotnet-sdk-8.0` if
  `dotnet` is missing (the dot.net install script is blocked too).

## Test setup

- r2modman profile **Villheim Test** on Tyler's Windows PC (a clone of his Valheim 1.0 profile). Profile folder:
  `%APPDATA%\r2modmanPlus-local\Valheim\profiles\Villheim Test`.
- Installed alongside: BepInEx, Jötunn 2.30.2, More World Locations (the `MWL_*` designs), PlanBuild (added
  2026-11-05, for more prefabs and blueprints; not wired into Villheim yet).
- Plugin folder: `BepInEx\plugins\bazilisx-Villheim\` holds the four built files and the three DLLs `vh gen` needs
  (`Jint.dll`, `Acornima.dll`, `System.Runtime.CompilerServices.Unsafe.dll`; see `docs/BLUEPRINT_LAB.md`).
- Logs: `BepInEx\LogOutput.log`. Villheim lines start with `[Info   :  Villheim]`. Turn on `VerboseLogging` in the
  config for per-villager detail.
- Design report: `BepInEx\Villheim\design-report.txt`, rewritten when older than 30 minutes. Lists every Meadows and
  Black Forest location with what Villheim keeps, skips, and the materials each design costs.
- Config: `BepInEx\config\bazilisx.villheim.cfg`. Reloads live when the file is saved.

## Keeping the game on the latest build

- Every push to `main` makes CI publish the "Latest test build" release (tag `dev-latest`) with both DLLs, their
  pdbs and `version.txt` (the build label: build number, then the short commit, for example `272-abc1234`).
- On the PC, `scripts/Villheim-Updater.ps1` copies each new build into the profile. No Git or .NET needed. Start it
  by opening PowerShell and pasting:
  `irm https://raw.githubusercontent.com/bazilisx/villheim/main/scripts/Villheim-Updater.ps1 | iex`
  Leave the window open. When the core changed it asks to close Valheim and finishes the copy by itself.
- Which logic build is live: `vh version` shows `build-<number>-<hash>-<build time>`. The number is the count of commits on
  main, so a higher number is a later build. A test branch build installed by hand is labeled from the main build it
  starts from, the branch and its commits past main, for example `build-272+look.2-abc1234`: it holds everything in main
  272 plus 2 commits of the look branch. Build such a label with `dotnet build -p:VillheimLabel=272+look.2-abc1234`.

## Hot reload loop

1. Change code in `src/Villheim.Logic`.
2. Build and copy `Villheim.Logic.pdb`, then `Villheim.Logic.dll`, into the plugin folder (or run
   `scripts/deploy.ps1` on the PC).
3. Within a few seconds the log shows `Loaded logic #N`. Valheim stays open.

Changes to `src/Villheim` (core) need `scripts/deploy.ps1 -Core` and a game restart.

## Deploying from a cloud Claude session

The session reaches the PC through the Claude desktop app's device bridge. The `profiles` folder above is connected
and shows up as `~/mnt/profiles` in `device_bash`.

1. Build in the cloud container: `dotnet build Villheim.sln -c Release`.
2. Copy `src/Villheim.Logic/bin/Release/Villheim.Logic.{dll,pdb}` to `/mnt/user-data/outputs/deploy/`.
3. `device_commit_files` both files to
   `~/mnt/profiles/Villheim Test/BepInEx/plugins/bazilisx-Villheim/` (use `force: true`).
4. Check the result with `device_bash`:
   `grep -a "Villheim" "$HOME/mnt/profiles/Villheim Test/BepInEx/LogOutput.log" | tail -40`.

If `~/mnt/profiles` is missing, ask Tyler to open this chat in the desktop app, or request access to the profiles
folder again.

## Testing the memory look (branch `look/memory`, D-160)

The memory look is on the `look/memory` branch only. CI and the updater only publish builds from `main`, so this
branch is copied into the profile by hand.

- Install: build the branch (`dotnet build Villheim.sln -c Release`) and copy `Villheim.dll`, `Villheim.pdb`,
  `Villheim.Logic.dll` and `Villheim.Logic.pdb` into `BepInEx\plugins\bazilisx-Villheim\` with the game closed. The
  core goes too because the installed core can be older than the one the branch logic is built against.
- The files they replace are kept in the same folder with `.main-backup` added to their names, with
  `villheim-build.txt.main-backup`. `villheim-build.txt` is set to `look-memory-<commit>`.
- Keep the updater window closed while testing: on its next check it would copy the latest `main` build over the
  branch.
- Going back: start the updater again (the line under "Keeping the game on the latest build"). The marker no longer
  matches `main`, so it installs the latest `main` build (the core once Valheim is closed). Or copy the
  `.main-backup` files back over the four files and the marker.

In game:

- `vh memory` puts a still villager in a T-pose (the model's rest pose, animator off) 3 m in front of you, facing
  you, with the look. `vh memory woman` for a woman, `vh memory clear` takes it away, `vh memory shaders` lists which
  game materials each part copies and the values in use now, `vh memory probe` writes each part of the model and of
  the nearest villagers to the log (shader, render queue, keywords, the values the look sets, passes per part).
  GhostLook ('3c - Villager looks') must be on.
- F1, section `3e - Look: memory`. Every dial shows on villagers and the model as you drag it.
  - `LookMode`: Memory (default on this branch) or Ghost (the first look, with its `Ghost*` dials in '3c').
  - Body: `MemoryAlpha` (night, 0.6; how strongly their own colors show), `MemoryAlphaDay` (0.75), `MemoryMilk`
    (night, 0.4; how much of what is behind them is covered, like frosted glass), `MemoryMilkDay` (0.5),
    `MemoryMilkColor` (whitish teal), `MemoryTint` (night, 0.35), `MemoryTintDay` (0.45), `MemoryTintColor` (teal),
    `MemoryBrightness` (1.1).
  - Glow around them: `MemoryGlow` (night, 0.35), `MemoryGlowDay` (0.18), `MemoryGlowColor` (teal),
    `MemoryGlowSpread` (0.015 m), `MemoryGlowSoftness` (0.6), `MemoryGlowLayers` (2, 0
    for no glow), `MemoryGlowEdge` (the game glow shader's edge fading numbers; leave as is unless the edges look wrong).
  - Feet: `MemoryFeetGlow` (on), `MemoryFeetStrength` (0.6), `MemoryFeetSize` (0.35 m), `MemoryFeetColor` (teal),
    `MemoryFeetLight` (0.5, 0 for no light).
- What each part is made from: `src/Villheim.Logic/Villagers/MemoryLook.cs` (summary at the top).

## Useful commands in game (F5 console, `devcommands` first)

- `villheim_found`: light a hearth in front of you.
- `villheim_grow`: adds free materials and starts the next building now, or finishes the building in progress.
- `villheim_wood <amount> [material]`: adds materials to the nearest village's stock.
- `vh empty`: takes every material out of the nearest village's stock and site chest. `vh version`: the live build.
  Any `vh <name>` reaches the logic, so new commands need no core change.
- `villheim_info`, `villheim_designs`, `villheim_locations`, `villheim_dump <location>`, `villheim_preview <location>`.
- `villheim_report`: rewrite the design report now.
- `vh villager`, `vh village`: inspect the nearest villager (voice, mood, thoughts, role, trade, bed) or village (type,
  chieftain, project, fence, known players, request). `vh raid`: send raiders to the nearest village.
- `vh blueprints`, `vh savebp <role-family-level> [radius]`: list blueprints; save the pieces around you as one.
- Dialogue lines live in `src/Villheim.Logic/Dialogue/*.txt` (format at the top of `lines.txt`) and are built into the
  logic DLL.

## Reading game code

Decompile the stubbed game assembly for signatures (method bodies are empty in the reference package):

```
dotnet tool install -g ilspycmd
export PATH=$PATH:~/.dotnet/tools DOTNET_ROLL_FORWARD=Major
D=~/.nuget/packages/digitalroot.valheim.common.references/1.0.22/ref/net48/assembly_valheim-publicized.dll
ilspycmd -t BaseAI $D > /tmp/BaseAI.cs
```

For real method bodies, decompile `assembly_valheim.dll` from the game's `valheim_Data/Managed` folder on the PC.

## Reading Millénaire

`Inspiration.zip` on main holds `millenaire-9.0.3.jar`. Its culture data (villages, villager types, building plans)
is plain JSON inside the jar under `millenaire/cultures/`. To read the code, decompile it with CFR (study material
stays in `/tmp`, never committed):

```
mkdir -p /tmp/mill && cd /tmp/mill && unzip -qo ~/villheim/Inspiration.zip 'Inspiration/millenaire-9.0.3.jar'
mkdir -p jar && (cd jar && unzip -qo ../Inspiration/millenaire-9.0.3.jar)
curl -sSL -o cfr.jar https://repo1.maven.org/maven2/org/benf/cfr/0.152/cfr-0.152.jar
(cd jar && zip -qr ../millcode.jar org/millenaire) && java -jar cfr.jar millcode.jar --outputdir src --silent true
```

The useful parts are `goal/`, `world/BuildingLocationFinder`, `building/` (BedManager, ConstructionTask),
`village/path/` and `dialogue/`. The findings are summed up in `docs/MILLENAIRE.md`. The building and village JSON files need no decompiler: unzip the jar and read `millenaire/cultures/`.

## Facts learned the hard way

- Since Valheim 1.0, terrain edits go straight to `TerrainComp.DoOperation` after claiming ownership. A `TerrainOp`
  created at runtime fails, because ops are sent over the network by prefab hash.
- `ZoneSystem.ZoneLocation.m_prefab` is a `SoftReference`: call `Load()` before use and `Release()` after.
- `WoodFarm1` and the `WoodVillage` locations are generated as dungeons and copy as nothing. `WoodHouse8` is a
  chicken coop. `AbandonedLogCabin*` no longer exist in 1.0.
- `ZoneManager.GetCustomLocation` throws when the name is missing; guard it with a flag.
- `VisEquipment.SetHairItem` and `SetBeardItem` take item hashes (int) in 1.0.
- A tree falls along the hit direction, away from whoever hit it.
- `Collider.ClosestPoint` only works on box, sphere, capsule and convex mesh colliders. On a concave mesh it returns
  the point it was given. Use `Collider.Raycast` at that collider for a surface point.
- `MineRock5.Damage` needs `HitData.m_hitCollider`.
- `Cover.GetCoverForPoint` (in `assembly_utils`) is the game's own roof and wall test; a workbench needs it to say
  under a roof with cover of at least 0.7.
- `Character.AttachStart` does nothing outside `Player`; villagers in bed are held at `Bed.m_spawnPoint` by hand with
  the `attach_bed` animator bool.
- The logic DLL can apply Harmony patches (`PatchAll` on load, `UnpatchSelf` on unload), so patches hot-reload too.
