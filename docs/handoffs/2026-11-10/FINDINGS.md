# Findings, 2026-11-09 night

Each item: evidence, primary cause, what was done, other suspects with how to check them, and what to try next.
Confidence: **seen** (in the log or the code, no doubt), **likely**, **guess**.

Evidence source unless noted: `BepInEx/LogOutput.log`, the play session of 2026-11-09 22:23 to 23:33 Mountain Time,
builds ec0f0b1 (before), 4554836 and 89027b9 (after).

---

## 1. Villages stop finding spots for buildings

### Evidence
- Before: 152 lines "No room for a Hub of radius 14.3 m: N spots ...; bad ground or crowded N", every ring out to
  115 m, with 0 for off level, on a path, door unreachable and search cap. 30 attempts at a longhouse in Neuftot,
  6 in Tingvoll. "plans its next project: a longhouse" five times.
- After 4554836 split the causes (hall, `bp:norse-hall_s1d1`):

  | Ring | Spots | Too near a building | Placed pieces within 15.3 m |
  |---|---|---|---|
  | 25 to 52 m (axis only) | 3 | 3 | 0 |
  | 25 to 52 m | 108 | 51 | 57 |
  | 38 to 68 m | 156 | 53 | 103 |
  | 54 to 84 m | 212 | 40 | 172 |
  | 69 to 97 m | 224 | 13 | 211 |

  Workshop (radius 10.1 m), 34 to 75 m: 880 spots; too near a building 195, too steep 1, placed pieces 684.
  Rocks, water, cliffs, biome, locations, unloaded ground: 0 everywhere.

### Cause A (seen): one project blocked all others
`Growth.Urgent` returns Hub whenever there is no hall, so a hall that fits nowhere was chosen forever.
**Done** (4554836, de3c31e): after six tries the project is set aside (`Growth.SetAside`, kept on the hearth) for
min(half the growth interval, 15 minutes) and the next project is chosen. Seen working: "No room for a longhouse
right now. The village goes on with other work" then "plans its next project: a workshop".

### Cause B (seen as a class, source not confirmed): placed pieces near almost every spot
The old test refused a spot when any `Piece` other than the hearth stood within the design's circle radius + 1 m.
**Which pieces is not known.** 89027b9 adds their names to the log ("In the way: name count, ..."), and the game
closed before a search ran on it. **First job tomorrow: have Tyler load the old village and read that line.**

Suspects for B, most likely first:
1. **The game's and More World Locations' small structures** (likely). Tyler's screenshots show ruined huts,
   lean-tos and fence gates round Neuftot, and MWL adds about 190 kinds of place. Each blocked a disc of about 20 m.
   Fix in de3c31e: pieces placed by the game inside a small location are clutter, taken down when ground is broken
   (`Ruins`). Check: the "In the way" names are ruin pieces (`wood_wall_roof`, `wood_pole`, `wood_fence` ...) and
   the spots lie outside the village ring.
2. **The village's own ring fence** (seen for the inner rings). The ring sat about 36 m out and every spot within
   15.3 m of it was refused. Fix in 4554836: own fence pieces are skipped and come down on the plot.
   Check: "In the way: wood_fence" or "stake_wall" with large counts in the 25 to 52 m ring.
3. **Long MWL walls or fences crossing the land** (`MWL_MeadowsWall1` and the like; guess). They are pieces in a
   location, so de3c31e treats them as clearable if the location is 30 m or less in radius (RuinMaxRadius). A longer
   wall would still block. If the names point here: raise RuinMaxRadius, or clear by piece count per plot.
4. **Pieces with no creator outside any location** (guess): things set down by test commands, the gallery, PlanBuild
   or Infinity Hammer. de3c31e keeps these as blocking on purpose, so a village never takes a test design apart.
   Check: the names are pool or gallery pieces and no location is near. Fix if so: tag what test commands place.
5. **Paths or amenities the village made that carry no village tag** (guess). Check: names like `sign`,
   `piece_chest_wood`, `piece_workbench` far from the hearth. Fix: set `Keys.BuiltBy` where they are made.
6. **Crops and saplings** (guess): planted things are pieces. Check: names starting `sapling_`.

### Cause C (seen in code): buildings spaced as circles
`Blueprint.Radius` is the farthest piece from the origin plus 2 m; spacing was both radii plus 4 m. A 23 x 12 m
hall counted as a 28.6 m circle and needed 26 m to the middle of an 8 m home.
**Done** (de3c31e): rectangles measured from the pieces, 2.5 m apart, measured at the line's last stage so a
building can always grow where it stands. See DECISIONS D-B and D-C for the trade-off.

Measured sizes of the pool designs (pieces' positions plus 1 m reach on each side is used in the code; the table
is positions only):

| Line | s1 (m) | s2 (m) | s3 (m) | Old circle radius s1 / s3 |
|---|---|---|---|---|
| hall | 23.2 x 12.1 | 27.6 x 12.6 | 31.6 x 20.1 | 14.3 / 18.3 |
| home a | 12.5 x 10.3 | 17.8 x 20.8 | 18.3 x 22.8 | 11.2 / 17.7 |
| home b | 8.5 x 8.3 | 11.1 x 12.1 | 15.8 x 17.8 | 8.4 / 14.5 |
| home c | 8.5 x 7.3 | 18.8 x 13.3 | 18.8 x 18.8 | 7.4 / 17.5 |
| woodworker | 6.4 x 6.3 | 12.1 x 7.0 | 12.1 x 13.8 | 6.2 / 11.8 |
| smithy | 8.5 x 10.3 | 9.0 x 11.0 | 9.0 x 11.4 | 10.1 / 10.3 |
| storehouse | 4.5 x 7.5 | 6.1 x 8.0 | 8.1 x 14.1 | 6.1 / 12.8 |
| farm | 8.0 x 14.3 | 13.2 x 16.3 | 16.0 x 23.0 | 13.4 / 16.8 |
| barn | 16.3 x 7.0 | 22.5 x 7.3 | 26.5 x 14.3 | 13.2 / 19.1 |

Stage 2 and 3 sizes include yards. Several lines are not centered on their origin (barn 3.8 m off, farm 4.9 m),
which made the old circle bigger than the building.

### Cause D (seen in a packing test): the distance bands spread the village
On flat open ground with nothing in the way (`sim.js`), plot distance from the hearth:

| Building (in build order) | Old rule | New, room kept for s3 | New, packed at today's size |
|---|---|---|---|
| home a, b, c | 23, 20, 20 m | 22, 20, 20 m | 22, 20, 20 m |
| hall | 25 m | 27 m | 24 m |
| woodworker | 34 m | 34 m | 34 m |
| storehouse | 20 m | 27 m | 22 m |
| smithy | 36 m | 34 m | 34 m |
| farm, barn | 43, 45 m | 41, 41 m | 41, 41 m |
| homes 4 to 6 | 40, 40, 45 m | 48, 44, 52 m | 26, 26, 32 m |

Workshops and farms could not start nearer than 0.45 of the village radius. **Done** (801c6cb): 0.3 for workshops,
0.4 for farms. The table was made before that change.

### Cause E (seen in code, not the cause here): small rocks blocked
Any `MineRock` or `MineRock5` refused a spot. **Done:** rocks under 12 m across are clutter; ore stays; every tree
is clearable.

### If villages still find no room after this
1. Read the "No room" line: it now gives the footprint size, counts per cause and the things in the way.
2. "pieces that stay" high: see suspects 3 to 6 above.
3. "too near another building" high in outer rings: print `state.Plots` (`vh village`). A stale or far plot is the
   only way 13 spots at 69 to 97 m were crowded with three homes within 25 m. Also try ReserveGrowthRoom off.
4. "too steep" high: the footprint test allows 3 m of height change (`Design.MaxTerrainDelta`). Try 4 m, or level
   more ground at ground-breaking (open thread: smoothing ground for buildings on slopes).
5. "ground not loaded" high: the outer rings lie past the loaded zones. Search only loaded rings, or wait.
6. Use `vh plot check` on a spot that looks free: it prints the one reason for that spot.

---

## 2. Lag

### Evidence (35 minutes on ec0f0b1, LagLog on, threshold 4 ms)

| Source | Total | Count | Worst |
|---|---|---|---|
| TryGrow | 42.0 s | 72 | 1,607 ms |
| TestVillage Palisade.Next | 30.5 s | 209 | 344 ms |
| Amenities.Find | 5.9 s | 374 | 87 ms |
| of which step 5 (HouseSigns.Job) | 4.4 s | 373 | 26 ms |
| HouseSigns.Update | 2.7 s | 179 | 31 ms |
| TestVillage LayPaths | 0.4 s | 26 | 60 ms |
| TestVillage PlaceAll | 0.3 s | 29 | 18 ms |

After 4554836 (about 2 minutes, same village): TryGrow 17 to 87 ms. After 89027b9 (about 25 minutes, mostly with
the game in the background): Amenities.Find 1.2 s in 46 (worst 72 ms), NoticeBoard.Update 1.1 s in 39 (worst
86 ms), HouseSigns.Update 0.6 s in 53 (worst 19 ms), Living.HearthTick 0.15 s in 9 (worst 60 ms).

### Primary cause (seen): whole-world piece scans inside loops
`Piece.GetAllPiecesInRadius` walks the game's list of every piece. It ran once per candidate spot (TryGrow, about
3,000 a search), once per ring position (Palisade.Find, about 150), and once per home (HouseSigns).
**Done:** each of the three lists the village's pieces once per call. TryGrow also judges each spot once, keeps the
verdict 90 s and stops at 25 ms a tick (`PlotSearchMs`).

### Other suspects and fixes not yet made
1. **NoticeBoard.Update, 28 ms average, every 30 s** (seen, cause not split). Suspects inside it: `Stats` calls
   `Lines`, which calls `NextStep.For`, which runs the whole next-job search (`Amenities.Upcoming`); `Lines` runs
   a second time on boards without headings; and each `Write` re-lays a sign's text. 730e909 caches
   `NextStep.For` 3 s and adds timers "NoticeBoard.Stats", "NoticeBoard.AssignHeadings" and "NextStep.For". Read
   those in the next log. Then: compute `Lines` once per update; skip the update when no stat changed.
2. **Amenities.Find steps other than 5** (seen, 25 ms at step 2 in an earlier log). Each step runs every time a
   villager asks for work. Fix: cache the found job per village for 2 to 3 s, cleared when a job is made or fails.
3. **Other `GetAllPiecesInRadius` callers** (seen in code, not measured): `Repairs.cs:261` (village radius + 10 m),
   `Smithing.cs:147`, `HearthGround` (2), `MapTables`, `Farms`, `Demisters`, `ConstructionSite`, `Trails`,
   `WorldLife`. A shared helper would fix all at once: a per-village list of its pieces, rebuilt at most every few
   seconds or when the game's piece count changes, with `InRadius` served from it.
4. **`Physics.OverlapSphere` per home or per sign** (seen in code): `HouseSigns.FrontDoor` (plot radius),
   `StorageChests` (25 m round the hearth, and each store), `Interior` (4 places), `Sleep.cs:321` (village radius
   + 15 m). Cache results per plot for 10 to 30 s.
5. **Living.HearthTick, up to 60 ms** (seen, cause unknown). Add `Perf.Time` round its parts.
6. **Log writing itself** (likely small): the [hands] lines were about 5,000 in 35 minutes; 4554836 and 913d5cd
   remove their cause. DebugLog and LagLog both write to disk; for a clean lag test turn DebugLog off.
7. **Frame-rate drop while the window is in the background** (seen): ticks 10 frames apart in the log are 5 s
   apart in time. Ignore lag numbers from a backgrounded game.

### Method for the next lag pass
`grep "Lag:" LogOutput.log | sed -E 's/.*Lag: (.*) took ([0-9.]+) ms.*/\2 \1/' | sed -E 's/step [0-9]+/step N/' |
awk '{n=$1;$1="";c[$0]++;s[$0]+=n;if(n>m[$0])m[$0]=n} END{for(k in c)printf "%9.0f ms %5d x max %6.0f %s\n",s[k],c[k],m[k],k}' | sort -rn`

---

## 3. Tools taken in and out, jobs changing too often

### Evidence
- 783 "takes $item_hammer in hand while Decor" and 781 "put away $item_hammer: nothing in hand for Decor" for one
  villager; the same for five others.
- "put away $item_pickaxe_antler: nothing in hand for BetweenJobs" followed by taking it out again.
- 18 "Loop watch" lines; typical: "breaking rocks / resting between jobs" 13 times in a minute, or "resting between
  jobs / gathering wood / carrying materials to the site / splitting logs" 9 times.

### Causes (seen in code)
- `HandItems.Uses` had no case for `Doer.Decor` or `Doer.BetweenJobs`, so the tool was put away at each brain tick
  and the work took it out again.
- `Chores.Update` returns false for the second or two between two steps of a job; the brain then reports
  `BetweenJobs`, shown as "resting between jobs". Each step and each gap counted as a change.

### Done (4554836, 913d5cd)
Decor holds the hammer. BetweenJobs keeps whatever is in hand. A tool is put away only after 2.5 s of not being
what the work uses (bed and fights don't wait). For 8 s after a job step ends, the gap reads as that job.

### Other suspects if churn remains
1. **Real switching between gathering wood and stone** (likely in part): the need list is re-read at each step.
   Fix: once a villager starts a material, keep him on it until his load is full or the need is met.
2. **Rock work ending after a few swings** (seen: `MaxSwingsPerSource`, and a broken rock becomes several parts):
   each part is a new job with a new "setting off" gesture. Fix: stay on parts of the same rock without the
   gesture.
3. **Hunting or cooking pulling the builder off** (fixed earlier in the day for settling; check it holds).
4. **Free time choices re-rolled too often** ("could not get to ... trying something else" 30 times): unreachable
   idle spots near the hearth. Fix: remember a spot that could not be reached for a few minutes.
5. The loop watch counts labels. If it still fires, log the `Doer` beside the label to tell real job changes from
   label changes.

---

## 4. Seen in the log, not worked on

- "Waleran can't get to the piece_workbench_ext1 in the bp:norse-home-a_s1d1; left for later."
- "Bedtime: Ivo can't get to his bed in the bp:norse-home-b_s1d1 (Stuck, N m short, try N)", four times.
- "Neuftot: no place found for inside sign 3 of the bp:norse-home-a_s1d1 (no door, or no wall by it)."
- "Minerock hit has no collider or invalid hit area on Rock_3_frac", 11 times after the mining fix.
- "Ermengarde walks to his bed": the pronoun ignores the villager.
- Plot clearing (`ClearArea`, now `Ruins.ClearPlot`) removes trees, rocks and ruins at once when ground is broken.
  Tyler describes villagers doing that work. See DECISIONS D-E.
- `Palisade.WantedRadius` capped the ring at VillageRadius + 6 m while buildings may stand out to twice the radius;
  raised to 2 x radius + 6 in 4554836.
