# Session history

Current facts only. Read this at the start of a session. Narrative is in `docs/daily-notes/`, goals in
`docs/ROADMAP.md`, how-to in `docs/DEVELOPMENT.md`.

## Current State (as of 2026-11-06)

- **Branch:** `main` (the cloud session branch is kept equal to it). All commits authored by Baz.
- **On main, not tested in game:** both 2026-11-06 overnight sessions (builder at the piece, levelled sites, beds and
  sleep, furnished buildings, Millénaire placement, cooking, roles and trades, dialogue library, walked A* paths,
  blueprints, growth tiers and upgrades, longhouse around the hearth, hunting, repairs, shelter, seats, trading,
  furniture by tier, morning hearth, moods, social layer, fence ring, reactions to the player, chronicle, night watch,
  foraging, signs, village types, Jarl, children, echo look, farms and animals, map pins, flat pads). Raids are built but off
  (`RaidsEnabled`); trading with villagers is off (`VillagerTrading`). Logic only, hot-reloads; core DLL unchanged. Rollback
  branches `stage/2026-11-06-a` to `-l`.
- **Network:** the cloud environment allows Thunderstore, Nexus, the Valheim wiki, CurseForge, Modrinth, the
  MineColonies wiki and millenaire.org. Nexus still answers 403 from the cloud.
- **Optional design packs:** OverDrive BiomeBlueprints (Thunderstore) gives Meadows and Black Forest upgrade chains when
  installed; never commit its files. Details:
  docs/daily-notes/2026-11/2026-11-06.md.
- **Blueprints:** `BepInEx/config/Villheim/blueprints` (and PlanBuild's folder), named `role-family-level`.
- **Dialogue:** `src/Villheim.Logic/Dialogue/*.txt`; the format is at the top of `lines.txt`.
- **Also untested from 2026-11-05:** sessions 4, 5 and 7 (doors, support order, free time, chest by the hearth,
  healing). Healing was replaced by the cooking rework.
- **Updater:** `scripts/Villheim-Updater.ps1` keeps the profile on main. The hearth's hover text shows the commit.
- **Cloud builds:** `scripts/build-cloud.sh` (nuget.bepinex.dev is blocked from cloud containers).
- **Profile mods:** BepInEx, Jötunn 2.30.2, More World Locations, PlanBuild (not used by Villheim yet).
- **Known issue to check:** the biome rule drops Meadows MWL designs that use core wood (likely including the
  Meadows hub `MWL_MeadowsTavern1`). The design report's materials column will show which designs remain.
- **Study material:** Millénaire findings are in `docs/LEARNINGS.md`; decompile steps in `docs/DEVELOPMENT.md`.

## Outstanding work

- Test the 2026-11-06 build in game. Watch: hammer animation, villagers in beds, cooking on the hearth station
  (`IsFireLit`), bed and workbench spots ("No covered room for" in the log), `interact` and `eat` triggers, jitter.
- Put blueprints in the blueprints folder (house-cabin-1, house-cabin-2...) to give villages curated buildings and
  upgrade chains; `vh savebp` can capture any build.
- Placement reachability and cliff rule; hearth upgrades (core change); stone only later in the Meadows (to decide);
  the village buying materials from players; raids.
- Gear by biome and village level beyond the protector weapons.
- Dialogue lines as a data file; two-villager chats with conditions.
- Inspiration.zip stays on main for now; Tyler will remove it with a force-push once the study is done.
- Use PlanBuild blueprints and prefabs as design sources; interior and exterior upgrades; biome cultures.

## Recent milestones

- **2026-11-06 (session 11: build order, replanting, motion trace)** - see docs/daily-notes/2026-11/2026-11-06.md
- **2026-11-06 (session 10: settling in before growing, jitter fixes from mod research, chest kept)** - see docs/daily-notes/2026-11/2026-11-06.md
- **2026-11-06 (session 9: flat pads, bronze axes, trading off, Jarl, echo look settings)** - see docs/daily-notes/2026-11/2026-11-06.md
- **2026-11-06 (fifth session: chronicle, raids, night watch, village types, children)** - see docs/daily-notes/2026-11/2026-11-06.md
- **2026-11-06 (third session: moods, social layer, fence, dialogue doubled)** - see docs/daily-notes/2026-11/2026-11-06.md
- **2026-11-06 (second overnight: dialogue library, blueprints, growth and upgrades, hunting, repairs, A* paths)** - see docs/daily-notes/2026-11/2026-11-06.md
- **2026-11-06 (overnight: beds, sleep, cooking, roles, placement, paths, dialogue)** - see docs/daily-notes/2026-11/2026-11-06.md
- **2026-11-05 (test notes and new requests: placement, repairs, roles, dialogue)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (test of 2108f23, gathering loop fixes)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (updater for the PC)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (villager AI rework after a second study of VikingColonies)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (fixes for the six test issues)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (first test of the site chest build)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (site chest, biome materials, movement, handoff docs)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (hot reload, first in-game tests, work and materials)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-04 (project start, 0.1.0)** - see docs/daily-notes/2026-11/2026-11-04.md
