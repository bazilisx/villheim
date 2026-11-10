# Changes on the branch overnight/2026-11-10

Nine commits on top of `ec0f0b1`, all authored by Baz. Status words: **ran** (seen working in Tyler's game),
**checked** (automated checks pass), **builds** (compiles, logic read through, not tried in the game).

## 4554836 Plot search counts each cause, lets the fence and small rocks be cleared, spreads over frames (ran, in part)

- `PlotFinder`: `Judge` and `Check` replace `IsGoodSpot` inside the search. One verdict per spot, kept 90 s and
  dropped when the village's plot count changes. `SpotFail` names the cause. `PlotFinder.Unfinished` is true when
  the search ran out of `PlotSearchMs` (new setting, 25 ms, in the config section that holds LagLog); `VillageBrain.TryGrow` then returns
  without counting an attempt and the next tick goes on from the kept verdicts.
- `Growth.SetAside` / `IsAside`: see FINDINGS 1, cause A.
- `Palisade`: `Find` lists the ring's pieces once (`Ring`, `RingPieceAt`), measures path distance only near a path;
  ring radius cap 2 x VillageRadius + 6.
- `HouseSigns`: one piece listing per village kept 5 s (`VillageSigns`); `Job` rests 20 s after finding nothing.
- `HandItems`: Decor holds the hammer.
- `DesignSpawner.ClearArea` leaves `TooBigToClear` things standing.
- Ran: set-aside, next project chosen, TryGrow 17 to 87 ms. Not seen: the fence coming down, a plot found.

## 89027b9 Plot search log names what stood in the way (builds; loaded in the game, no search ran)

- The "No room" line ends "In the way: name count, ..." (top six).

## de3c31e Real footprints, clearing, hold-ups (builds)

- New `Village/Footprints.cs`: `Foot` (a turned rectangle), `Footprints.Of(design, position, yaw, radius, grown)`,
  `TooNear` (separating axes), `Samples` (21 ground points). Sizes come from the blueprint's pieces plus 1 m; a
  copied location falls back to a square of 0.75 x radius. `grown` joins the line's later stages
  (`Blueprints.NextLevel`).
- `PlotFinder.Check(foot, grown, ...)`: order of tests is crowding, hearth, pieces that stay, ground, water, slope,
  cliff, biome, location, physics box. `InTheWay` uses `Physics.OverlapBox` over the footprint.
- New settings (in the config section that holds RadiusPerStage): `HearthMargin` 4.5, `BuildingGap`
  2.5, `ReserveGrowthRoom` true (added in 913d5cd), `BoulderStaysFrom` 12, `ClearRuins` true, `RuinMaxRadius` 30,
  `ProtectedPlaces` (name words).
- New `Village/Ruins.cs`: `Clearable(Piece)`, `Clearable(Location)`, `ClearPlot(hearth, foot)`. A piece is a
  clearable ruin when no player made it (`Piece.IsPlacedByPlayer`), no village built it, it has `WearNTear`, and it
  stands in a location that allows building, has no interior, is 30 m or less in radius and is not on the
  protected list. Half of each piece's recipe goes to the village chest.
- `PlotFinder.Stays(piece, villageId, ownOk)` is the one rule for which placed pieces block.
- `PlotFinder.CanUpgrade` uses footprints and takes the next design's name.
- `PlotFinder.HoldUp(villageId)`: the reason the last search failed, with advice, shown by `NextStep.Text` (the
  hearth's hover). Cleared when ground is broken or `vh grow` runs. Not on the notice board yet.
- `Growth`: set-aside projects stored on the hearth (`villheim_aside`); `ClearAside` on `vh grow`.
- Risks to check in the game: (1) `Location.GetLocation(p, false)` returns the first location whose radius holds
  the point, so two overlapping places are judged by one of them; (2) a ruin half inside a plot loses the pieces on
  the plot and the rest may fall by itself; (3) the grid is now 4 m for every design, about 900 spots in the widest
  ring, kept cheap by the verdict cache; (4) the hall's "straight behind the hearth" rule now tests only spots at
  least half its short side plus 14.5 m out.

## 913d5cd Tools and job labels (builds)

- `HandItems`: `BetweenJobs` allows anything in hand; `WrongSince` and `PutAwayAfter` (2.5 s).
- `Status`: `LastChore` and `BetweenJobsGrace` (8 s).

## 730e909 Next step cache and timers (builds)

- `NextStep.For` returns a result up to 3 s old; `Work` holds the old body. Timers: "NextStep.For",
  "NoticeBoard.Stats", "NoticeBoard.AssignHeadings".
- Risk: the hearth's hover and the board can be up to 3 s behind.

## 1f95633 Store rooms and the pool audit (checked)

- `lib/decorate.js`: `storeLabels` (before the room is topped up) and `storeStacks` (after), for rooms whose use is
  storage, at d2 and d3. `placeStorageRow` puts its sign on the nearest plain stretch. `SOLID_CATS`: chests,
  stations, beds and tables may not reach into one another by more than 3 cm of the game's solids.
- `lab/audit_pool.js`: see GENERATOR.md.
- `src/Villheim.Logic/Generator/lab.js` rebuilt with `node lib/build_engine.js`.
- Checks: `check_set.js 2` 224 of 225, 90 of 90, 147 of 147 (identical to the run before the change, same one
  overlap failure); `test_structure.js` 36; `tools/gen-test/run.sh` 5 of 5 byte for byte; pool regenerated, 81 of
  81 pass, decor stages nest at every stage.
- The pool on Tyler's PC is the old one. Regenerate with `node lab/make_testpool.js` or `vh testpool make`.

## 382142c Plots by hand (builds)

- New `Village/PlotPick.cs`; `PlotFinder.JudgeAt`; `Growth.PendingRole`; command `vh plot check | here | clear`.
- `VillageBrain.TryGrow` takes a chosen plot before its own search. The pick stays until ground is broken.
- The design for a hand-picked plot is fixed by the village's seed and building count, so a preview and the
  building agree. This differs from the random pick of the village's own search.

## 801c6cb Ruins on upgrades and test villages; nearer rings (builds)

- `ConstructionSite.TakeDownNext` and `TestVillage` call `Ruins.ClearPlot`.
- `PlotFinder.Band`: workshops from 0.3 of the radius (was 0.45), farms and others from 0.4 (was 0.45).

## d436074 Session notes

- `docs/daily-notes/2026-11/2026-11-09.md` (Session 4), `docs/SESSION_HISTORY.md`, `docs/ROADMAP.md`.
- When merging, change "on the branch, not on main" wording in SESSION_HISTORY to match.
