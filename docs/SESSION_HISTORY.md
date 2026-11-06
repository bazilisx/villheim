# Session history

Current facts only. Read this at the start of a session. Narrative is in `docs/daily-notes/`, goals in
`docs/ROADMAP.md`, how-to in `docs/DEVELOPMENT.md`.

## Current State (as of 2026-11-05)

- **Branch:** `main` only. All commits authored by Baz.
- **Deployed to the Villheim Test profile:** logic build from 2026-11-05 session 2 (site chest, biome materials,
  walker, rewritten chores). Core DLL unchanged since `Fix access errors, terrain edits and location registration`.
- **Not deployed yet:** 2026-11-05 session 4 fixes for the six test issues (tools per job, open site chest, idle
  routine, doors, support-aware build order, no bee hives). Logic only, hot-reloads. Start the next session by
  deploying with `scripts/deploy.ps1` and testing them; details in docs/daily-notes/2026-11/2026-11-05.md, Session 4.
- **Cloud builds:** nuget.bepinex.dev is blocked from cloud containers. `scripts/build-cloud.sh` compiles against
  nuget.org and GitHub copies instead. No computer folder was shared in session 4, so nothing could be deployed.
- **Profile mods:** BepInEx, Jötunn 2.30.2, More World Locations, PlanBuild (just added, not used by Villheim yet).
- **Known issue to check:** the biome rule drops Meadows MWL designs that use core wood (likely including the
  Meadows hub `MWL_MeadowsTavern1`). The design report's materials column will show which designs remain.
- **Study material:** VikingColonies source and decompiled Innangard were in `/tmp/study` of the 2026-11-05 cloud
  session and are gone. Ideas are kept in `docs/LEARNINGS.md`.

## Outstanding work

- Test the session 4 fixes in game: right tool per job, open chest count, idle routine, doors, build order, bee hives.
- Movement still stutters (Walker unchanged apart from doors and waiting for players).
- Grid-searched paths that join into streets (Innangard-style A* over a small grid).
- Newcomers only for free beds, by day, walking in from the village edge.
- Use PlanBuild blueprints and prefabs as design sources.
- Evening routine at fires and benches; interior and exterior upgrades; biome cultures.

## Recent milestones

- **2026-11-05 (fixes for the six test issues)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (first test of the site chest build)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (site chest, biome materials, movement, handoff docs)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-05 (hot reload, first in-game tests, work and materials)** - see docs/daily-notes/2026-11/2026-11-05.md
- **2026-11-04 (project start, 0.1.0)** - see docs/daily-notes/2026-11/2026-11-04.md
