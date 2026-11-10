# Villheim handoff, 2026-11-09 (Session 4, about 22:50 to 23:30 Mountain Time)

Written for the next session. The session that wrote this could read the repo but could not push
(`bazilisx/villheim` was not attached to it), so its work is in the two patch files beside this note.

## Start here

1. Confirm push access first: `git push --dry-run origin main`. If it is refused, stop and tell Tyler.
2. Read `CLAUDE.md` in full, then the 2026-11-09 daily note from "Session 3" down.
3. Set the commit identity: `Baz <113806309+bazilisx@users.noreply.github.com>`. No attribution lines. A commit
   check in the cloud session may ask for commits to be re-authored as Claude; Tyler's rule is Baz, so leave them.
4. Apply the patches on top of `ec0f0b1` (or current `main`): `git am 0001-*.patch 0002-*.patch`.
   Both keep Baz as author. They built clean with `dotnet build Villheim.sln -c Release`
   (`apt-get update && apt-get install -y dotnet-sdk-8.0` first; nuget.bepinex.dev answered 200).
5. Do not push yet. Finish Bundle A (below), then push once and name the build to Tyler.

## Rules Tyler set in this session

- Builds reach the game only through `main` and the updater. No copies into the plugin folder through the folder
  link. (This session copied two builds in without saying so; Tyler stopped it for that.)
- One build per bundle of related fixes, each announced with its hash and what to test. No build every few minutes.
- Answer Tyler's messages and questions before going on with other work. His requests come first, in his order.
- Stop and ask when something blocks the agreed route (as with the refused push).

## State of Tyler's game right now

- `main` is `ec0f0b1`.
- The plugin folder holds a logic build copied in by hand: `4554836` loaded at 23:03 (log line "Loaded logic #7").
  `89027b9` was copied in about two minutes later; whether it loaded was not checked.
- The updater compares `version.txt` with `villheim-build.txt` (still `ec0f0b1`), so it leaves these alone until the
  next push to `main`, which replaces them.
- Log: `BepInEx/LogOutput.log` in the "Villheim Test" profile. LagLog and DebugLog are on.

## What was found

### Why the village stopped finding spots (village Neuftot, 3 homes, hall pending)

- Growth picked the hall as the one urgent project, forever. Each failed search counted an attempt; after six the
  village paused and chose the hall again. Homes and workshops never got a turn. 30 hall attempts in 35 minutes.
- The old log lumped every refusal as "bad ground or crowded". After `4554836` split the causes, the first full
  search read (hall `bp:norse-hall_s1d1`, radius 14.3 m):
  - 25 to 52 m (hall axis only): 3 spots, all too near another building.
  - 38 to 68 m: 156 spots; too near another building 53, placed pieces 103.
  - 54 to 84 m: 212 spots; too near another building 40, placed pieces 172.
  - 69 to 97 m: 224 spots; too near another building 13, placed pieces 211.
  - Rocks, slope, water, cliffs, biome, locations: 0 in every ring.
- So the cause is placed pieces within radius + 1 m (15.3 m) of nearly every spot. Which pieces is not confirmed:
  `89027b9` adds their names to the log line ("In the way: ..."); read the log for that line first.
- Likely sources: the village's own ring fence (inner rings), and the game's Meadows ruins and lean-tos (Tyler's
  second screenshot shows two lean-tos and a fence gate; his first shows ruined huts at the edge). The old code
  treated every piece that was not the hearth as untouchable.
- "Too near another building" at 69 to 97 m with three homes close to the hearth is odd. Check what `state.Plots`
  holds for Neuftot (stale or far plots) with `vh village`.
- Tyler's hunch (small objects block) was partly right in code: any MineRock or MineRock5, however small, blocked,
  while trees, stumps, bushes and logs were clearable. It was not the cause in this village.

### Lag, from the log before these builds (about 35 minutes of play)

| Source | Total | Count | Worst |
|---|---|---|---|
| TryGrow (failed plot searches) | 42.0 s | 72 | 1.6 s |
| TestVillage Palisade.Next | 30.5 s | 209 | 344 ms |
| Amenities.Find (step 5, HouseSigns.Job, is nearly all of it) | 5.9 s | 374 | 87 ms |
| HouseSigns.Update | 2.7 s | 179 | 31 ms |
| TestVillage LayPaths | 0.4 s | 26 | 60 ms |

- Common root: `Piece.GetAllPiecesInRadius` walks every piece in the world, and these paths called it per spot,
  per ring position or per home.
- TryGrow after `4554836`: 23 to 87 ms in the first searches. Fence and sign changes are not measured yet.
- Hammer flicker: `HandItems.Uses` had no case for `Status.Doer.Decor`, so the hammer was put away at each tick and
  taken out again by HomeDecor (about 2,600 log lines each way per session).

## What the two patches change

`0001` (4554836):
- `PlotFinder`: each spot judged once (`Judge`, `Check`) and remembered 90 s; causes counted separately
  (`SpotFail`); a search stops after `PlotSearchMs` (new setting, 25 ms) and goes on at the next tick
  (`PlotFinder.Unfinished`, no attempt counted); pieces round the village listed once per search; the village's own
  ring fence is no obstacle; rocks and other natural things under `ClearableSize` (7 m) are clutter the site clears;
  ore, trees with `m_minToolTier > 1` and bigger formations block.
- `Growth.SetAside`: a project with no room after six attempts is left out of the choice for
  min(half the growth interval, 15 minutes) and the village picks another. Kept in memory only (lost on reload).
- `VillageBrain`: uses the above; the old "room to build" pause is gone.
- `Palisade.ClearFor`: takes down ring fence pieces on a new plot (half the materials back). Ring radius cap raised
  to 2 x VillageRadius + 6. `Palisade.Find` lists ring pieces once (`Ring`, `RingPieceAt`) and only measures the path
  distance near a path.
- `DesignSpawner.ClearArea` leaves things `TooBigToClear` standing.
- `HouseSigns`: one piece listing per village kept 5 s; `Job` rests 20 s after finding nothing to do.
- `HandItems`: Decor holds the hammer.
- `PathPlanner`: `IsOre`, `SolidBounds` made internal.

`0002` (89027b9): the "No room" line ends with the top six things in the way and their counts.

None of this is logged in the daily note, SESSION_HISTORY or ROADMAP yet. Do that with Bundle A.

## Tyler's notes from this session (to do, in his order)

1. **Clearable things.** Any wood that can be chopped or removed is clearable (oaks too: drop the
   `m_minToolTier` rule in `PlotFinder.TooBigToClear`). Only massive boulders, house size or larger, block. Proposed
   limit about 12 m across; Tyler has not confirmed the number (Decisions tab). The game's own Meadows structures
   (lean-tos, ruined huts and houses, small structures) may be removed by villagers and turned into materials.
   Player-built pieces and other villages still block. Open question for the code: telling the game's ruin pieces
   from a player's (ruin pieces come from locations and carry no creator; check `Piece.m_creator` / `IsPlacedByPlayer`
   and `Location` membership in the decompiled game code before relying on it).
2. **Spacing.** Buildings may stand much closer. Tyler asked for the real radius of the pool designs at s3: measure
   it per building from the 81 pool files and report it. Today: `Blueprint.Radius` = farthest extent + 2 m; spacing =
   both radii + 4 m `Gap`; piece check = radius + 1 m. Proposed: real rectangular footprints (turned by yaw) with a
   path-width gap of 2 to 3 m between walls. The hearth keeps its dirt circle (`HearthGround.LevelRadius`, 10 m)
   plus about 15 feet (4.5 m); past that everything is open. No overlap or clipping between buildings.
3. **Visible hold-ups.** When a project can't be placed, show why in game (hearth hover, notice board) and what the
   player can do. Another project goes on meanwhile (done in `0001`; make the set-aside survive a reload).
4. **Picking a spot by hand,** as in Millénaire: a tool made at the village notice board (KnifeWood prefab) that
   shows the pending building's size on the ground where the player points, as a colored shadow or circle, and sets
   the plot. Design choices go in the Decisions tab first.
5. **Villages must still find spots by themselves.** The tool is a second route only. Confirm the cause from the
   log before and after the fix and show Tyler the counts.
6. **Tool and job churn.** Villagers must not take tools in and out rapidly (Decor hammer fixed in `0001`), or
   change jobs so often that the console flags "doing 9 things in a minute". Find what drives those flags and give
   jobs and tools a minimum time before a switch, emergencies excepted.

## Bundles agreed with Tyler

- **Bundle A:** notes 1, 2, 3 and 5, plus the two patches. One push, one build.
- **Bundle B:** note 6.
- **Bundle C:** note 4, after Tyler's answers in the Decisions tab.
- Then the generator work from the project scope: storehouse chests stacked and labeled along the walls, better
  window-box pieces, ground smoothing for buildings on slopes, merging `feat/layout` (WIP b9a500d, run the full
  checks first), more shape variety for the weak stage-3 lines (hall, storehouse, barn), households and roles
  (D-072 to D-078), D-080.

## Other open items seen in the log

- `Waleran can't get to the piece_workbench_ext1 in the bp:norse-home-a_s1d1; left for later.`
- `Bedtime: Ivo can't get to his bed in the bp:norse-home-b_s1d1 (Stuck, ... try N)`.
- Several "could not get to ..." lines for hearth-side spots (watch, campfire, stroll).
- `Minerock hit has no collider or invalid hit area on Rock_3_frac` still appears 11 times.
- `ClearArea` removes trees and rocks at once when ground is broken. Tyler describes villagers doing that work
  (breaking rocks, clearing trees). Whether clearing a plot should be villager work is a question for the
  Decisions tab.

## For the Decisions tab (not yet entered; this session had no sheet access loaded)

- Boulder size that blocks a plot (proposed 12 m across).
- Gap between buildings (proposed 2 to 3 m between walls) and hearth clearance (dirt circle + 4.5 m).
- Spot tool: recipe and where it is made, footprint shape shown (rectangle or circle), colors, whether it may
  override refusals such as ruins or slope, who may use it.
- Plot clearing as villager work or instant.
