# Session history

Current facts only. Read this at the start of a session. Narrative is in `docs/daily-notes/`, goals in
`docs/ROADMAP.md`, how-to in `docs/DEVELOPMENT.md`.

## Current State (as of 2026-11-05)

- **Branch:** `main` only. All commits authored by Baz.
- **Deployed to the Villheim Test profile:** logic build from 2026-11-05 session 2 (site chest, biome materials,
  walker, rewritten chores). Core DLL unchanged since `Fix access errors, terrain edits and location registration`.
- **New test world** since 2026-11-05 session 5.
- **Not confirmed in game:** sessions 4 and 5 (tools per job, doors, support-aware build order, own villager brain,
  free time with mood, honest reach, no free starting stock, village chest by the hearth, small things made by the
  hearth). Logic only, hot-reloads. The session 4 DLL was most
  likely never loaded. Start the next session by checking the hearth's hover text shows the latest commit
  (`scripts/Villheim-Updater.ps1` keeps the profile on main), then test; details in docs/daily-notes/2026-11/2026-11-05.md,
  Sessions 4 and 5.
- **Cloud builds:** nuget.bepinex.dev is blocked from cloud containers. `scripts/build-cloud.sh` compiles against
  nuget.org and GitHub copies instead. No computer folder was shared in session 4, so nothing could be deployed.
- **Profile mods:** BepInEx, Jötunn 2.30.2, More World Locations, PlanBuild (just added, not used by Villheim yet).
- **Known issue to check:** the biome rule drops Meadows MWL designs that use core wood (likely including the
  Meadows hub `MWL_MeadowsTavern1`). The design report's materials column will show which designs remain.
- **Study material:** VikingColonies source and decompiled Innangard were in `/tmp/study` of the 2026-11-05 cloud
  session and are gone. Ideas are kept in `docs/LEARNINGS.md`.

## Outstanding work

- Test sessions 4 and 5 in game: work starts, reach, tools, doors, build order, free time, evening ring, smoothness.
- Sitting on chairs and benches, beds, real cooking, feeding the fire pit.
- Millénaire and Innangard study from `Inspiration.zip` on branch `clearcreekmakerspace-inspiration`, one area at a
  time. Delete that branch afterwards (Millénaire is All Rights Reserved).
- Grid-searched paths that join into streets (Innangard-style A* over a small grid).
- Newcomers only for free beds, by day, walking in from the village edge.
- Use PlanBuild blueprints and prefabs as design sources.
- Evening routine at fires and benches; interior and exterior upgrades; biome cultures.

## Recent milestones

- **2026-11-05 (updater for the PC)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (villager AI rework after a second study of VikingColonies)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (fixes for the six test issues)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (first test of the site chest build)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (site chest, biome materials, movement, handoff docs)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (hot reload, first in-game tests, work and materials)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-04 (project start, 0.1.0)** - see docs/daily-notes/2026-11/2026-11-04.md
