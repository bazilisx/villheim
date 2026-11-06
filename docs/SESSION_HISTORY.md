# Session history

Current facts only. Read this at the start of a session. Narrative is in `docs/daily-notes/`, goals in
`docs/ROADMAP.md`, how-to in `docs/DEVELOPMENT.md`.

## Current State (as of 2026-11-06)

- **Branch:** `main` (the cloud session branch is kept equal to it). All commits authored by Baz.
- **On main, not tested in game:** the 2026-11-06 overnight work (builder at the piece, levelled sites, beds and sleep,
  bed-based capacity, furnished buildings, Millénaire placement, real cooking, roles and trades, dialogue, walked
  paths). Logic only, hot-reloads; core DLL unchanged. Details and what to watch for: docs/daily-notes/2026-11/2026-11-06.md.
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
- Central building built around the hearth and cooking station (Tyler, 2026-11-06).
- Weighted growth with tiers and one pending project (Millénaire), replacing the fixed plan in `Culture`.
- A* paths that join into a tree toward the hearth; placement reachability and cliff rule.
- Repairs (structural first), hearth upgrades, stone only later in the Meadows (to decide).
- Gear by biome and village level beyond the protector weapons.
- Dialogue lines as a data file; two-villager chats with conditions.
- Inspiration.zip stays on main for now; Tyler will remove it with a force-push once the study is done.
- Use PlanBuild blueprints and prefabs as design sources; interior and exterior upgrades; biome cultures.

## Recent milestones

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
