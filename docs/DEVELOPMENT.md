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

## Test setup

- r2modman profile **Villheim Test** on Tyler's Windows PC (a clone of his Valheim 1.0 profile). Profile folder:
  `C:\Users\tyler\AppData\Roaming\r2modmanPlus-local\Valheim\profiles\Villheim Test`.
- Installed alongside: BepInEx, Jötunn 2.30.2, More World Locations (the `MWL_*` designs), PlanBuild (added
  2026-11-05, for more prefabs and blueprints; not wired into Villheim yet).
- Plugin folder: `BepInEx\plugins\bazilisx-Villheim\` holds the four built files.
- Logs: `BepInEx\LogOutput.log`. Villheim lines start with `[Info   :  Villheim]`. Turn on `VerboseLogging` in the
  config for per-villager detail.
- Design report: `BepInEx\Villheim\design-report.txt`, rewritten when older than 30 minutes. Lists every Meadows and
  Black Forest location with what Villheim keeps, skips, and the materials each design costs.
- Config: `BepInEx\config\bazilisx.villheim.cfg`. Reloads live when the file is saved.

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

## Useful commands in game (F5 console, `devcommands` first)

- `villheim_found`: light a hearth in front of you.
- `villheim_grow`: adds free materials and starts the next building now, or finishes the building in progress.
- `villheim_wood <amount> [material]`: adds materials to the nearest village's stock.
- `villheim_info`, `villheim_designs`, `villheim_locations`, `villheim_dump <location>`, `villheim_preview <location>`.
- `villheim_report`: rewrite the design report now.

## Reading game code

Decompile the stubbed game assembly for signatures (method bodies are empty in the reference package):

```
dotnet tool install -g ilspycmd
export PATH=$PATH:~/.dotnet/tools DOTNET_ROLL_FORWARD=Major
D=~/.nuget/packages/digitalroot.valheim.common.references/1.0.22/ref/net48/assembly_valheim-publicized.dll
ilspycmd -t BaseAI $D > /tmp/BaseAI.cs
```

For real method bodies, decompile `assembly_valheim.dll` from the game's `valheim_Data/Managed` folder on the PC.

## Facts learned the hard way

- Since Valheim 1.0, terrain edits go straight to `TerrainComp.DoOperation` after claiming ownership. A `TerrainOp`
  created at runtime fails, because ops are sent over the network by prefab hash.
- `ZoneSystem.ZoneLocation.m_prefab` is a `SoftReference`: call `Load()` before use and `Release()` after.
- `WoodFarm1` and the `WoodVillage` locations are generated as dungeons and copy as nothing. `WoodHouse8` is a
  chicken coop. `AbandonedLogCabin*` no longer exist in 1.0.
- `ZoneManager.GetCustomLocation` throws when the name is missing; guard it with a flag.
- `VisEquipment.SetHairItem` and `SetBeardItem` take item hashes (int) in 1.0.
- A tree falls along the hit direction, away from whoever hit it.
