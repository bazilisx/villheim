---
status: active
type: handoff
---
# Design helper, 2026-11-10: library first, richness, decor in any biome

Scope: the blueprint lab only (`tools/blueprint-lab`, the bundled `src/Villheim.Logic/Generator/lab.js`, lab docs). Nothing
here is tried in the game. Measurements are in `richness-measurements.json` beside this file (refusal histograms, top
prefabs, per biome and per stage, for each state named below).

## Tools added
- `lab/richness.js [--seeds n] [--quick] [--json out] [--list] [--why]`: 216 designs (home, longhouse, tavern, smithy,
  workshop, storage; Meadows, Black Forest, Swamp, Mountain, Plains, Mistlands; s1d3, s2d3, s3d3; two seeds; no
  yards). Reports decor prefabs, the share of decor from mined sets (kb `KB-`), creative sets (`KC-`), hand-made kits
  (`BK-`) and the decorator's own rules, sets placed, the share of the 16 most used prefabs, per biome and stage, and
  why the library refused sets (`lib/kitbash.js` `setStats`, every refusal has a code; `--why` lists the audit test and
  clip partner behind refusals).
- `lab/render_views.js`: four views with the roof cut off and a ground floor plan of one design.
- `lab/households_sheet.js`: one house for six households as plans side by side (was `/tmp/int/sheet.js`).
- `lab/make_testpool.js --sample` writes and gates the Norse Meadows pool and a norse-forest Black Forest and a
  middle-eastern Plains pool; `--culture`, `--biome` write any one pool.

## Measurements (richness, 216 designs)

| State | Prefabs | Mined | Creative | Hand-made | Decorator | Mined sets | Creative sets | Top 16 | Meadows prefabs |
|---|---|---|---|---|---|---|---|---|---|
| Baseline 5277c77 | 80 | 2.6 % | | 40.1 % | 57.3 % | 58 | | 80.7 % | 27 |
| Ceilings by solids 77452c3 | 79 | 3.0 % | | 40.6 % | 56.4 % | 64 | | 81.5 % | 28 |
| Main with creative sets 5e7588a | 95 | 2.1 % | 3.7 % | 38.3 % | 55.9 % | 43 | 48 | 81.2 % | 37 |
| Library first 1545946 | 106 | 3.5 % | 7.6 % | 41.6 % | 47.3 % | 75 | 57 | 80.3 % | 44 |
| After 539a56f | 103 | 3.7 % | 7.5 % | 42 % | 46.8 % | 73 | 60 | 79.9 % | |
| Decor in any biome (WIP, this branch) | 118 | 3.6 % | 10 % | 44.9 % | 41.5 % | 77 | 71 | 77.5 % | 74 |

Baseline refusals of mined sets (95 placed, 2,005 refused): a clip with something placed 417 (mostly the decorator's
own furniture), the audit's rest and visible-clip tests 367, over the ceiling 315, no prefab in reach 166, tall in front
of a window 124, one kind only 114. Per piece tried: "hung" itemstand, wood_ledge and walltorch (into a wall's visible
relief) and "mount" sign (no plain wall behind) lead the audit refusals; the clips were with the decorator's storage,
beds, tables and stations.

Ceilings: the storey is 3 m already (`generate.js` `MIN_STOREY`). Rooms under 45 degree roofs read 1.8 to 2.0 m along
the eaves walls because `decorate.js` `roomModel` used a sloped roof piece's bounding box. Reading the solids' underside
gave 2.6 to 2.7 m; ceiling refusals 315 to 156. Taller storeys on the s3d3 sample: 3 m 69 prefabs, 3.3 % mined; 3.5 m 75
and 4.3 %; 4 m 82 and 5.1 %. Kept at 3 m.

Tried and dropped: a larger library budget (no effect, refusals bind); the decorator's extras cut to 0.8 of the corpus
rate (rooms emptier, a Black Forest tavern lost rugs; mined share 6.4 to 6.8 % only); removing a refused set from a
room's candidates (no time saved, output changed); a per-room cache of refused set spots (no time saved).

Engine time: gen-test 13.9, 32.8, 10.6, 1.4, 9.0 s on main before this work; 17.2, 35.4, 14.2, 1.5, 13.5 s after the
library first. The caches of 539a56f (solids and boxes per piece, `classOf` per name, one neighbor read per piece,
hopeless sets skipped) save 8 to 12 % of node time with byte-identical output. Later gen-test runs ran at load average
10 and are not comparable.

## Commits on main
- 7850007 richness measure; 77452c3 ceilings from the solids; 1545946 library first (extras marked and moved aside by
  sets, layout-plan spots for wall sets, hung pieces slide, raised sections, `furnClash`, `asBuilt`, biomeSafe decor);
  e44db1e clips made on purpose marked in `#VillheimClips` (D-098); d9103bf richness floors in the pool gate,
  `#VillheimSets`, `--sample`; 5418170 notes.
- daee4ca Black Forest and Plains pools pass the gate (motif banners tested again at commit, no built kit as the d1
  opener, the U-plan well's barrel, yard paving out of the gate's way).
- 4daedeb barrels, chests and benches in living rooms go where they are used (the rows of barrels in the Swamp house
  were barrels, drawn by the plan renderer like stacked chairs).
- 539a56f engine time caches.

## This branch: decor in any biome (D-065, D-126), not merged
Tyler, 2026-11-10: "one rug per biome and one plant per sill are not rules I've ever set nor any restriction I ever want
to establish. To be clear, there are no restrictions on any level of furniture, decoration, or limits on whats shown for
any decor... decor can be freely used across any biome, but build pieces (walls, roofs, etc.) should (mostly) come from
the relevant biome and surrounding biomes ... Please ensure there are not limitations on the number of rugs, flowers, or
truly any type or quantity of decor, furniture, or interior/exterior items."

Done on the branch:
- `lib/pieces.js` `decorOk` is the single rule: any non-structural prefab in any biome; structural pieces the village's
  biome, the earlier ones and the next (`buildReach`). Readers changed: `decorate.js` `ok`, `kitbash.js`
  `can`/`canMake` and the creative sets' filters, `persona.js` `itemFrom` (all biomes, the own one weighs more),
  `generate.js` `biomeSafe` (decor never swapped; structure to biome plus one), `checks.js` materials and beds (any bed
  counts), `details.js` gable banners and the door bench, `yards.js` work props, `lab/check_interiors.js` decorBiome.
- Flavor weights, never exclusions: `decorate.js` `flavorD`, `kitbash.js` `flavorB` (two biomes or more ahead weigh less).
- More of each kind in the decorator's table (`CLONES_D`: moose, seal, bear and bog witch deer rugs, Dvergr table and
  stool, black marble and blackwood benches, banners 06 to 11, the blue torch); each room draws its own rug, seats,
  table, lights, banner and carving (`varyKit`).
- No counts: `kitbash.js` `cap` only for dining sets per room, `budget` without ceilings; `decorate.js` `fill` extras
  halve their weight with each use instead of a MAX; barrels in living rooms may repeat; set rugs and pots draw any of
  their kind (`VARY_SLOTS`); sill and yard flowers vary by place (`details.js` `SILL_PLANTS`, `yards.js` `FLOWERS`).
- Docs: BLUEPRINT_LAB.md Rules "Decor in any biome", Materials; INTERIOR_DESIGN.md "Biome of each piece" and kits.

Checks on the branch (one full run): check_set 224 of 225, 90 of 90, 147 of 147; test_structure 36 hold; test_sizes 0
off (95 pieces); Norse Meadows pool pass (richness 11.8, 0.516, 1.54); Black Forest pool pass; lineage as main (hall s1
to s2 69 against 68). Failing or worse:
- Plains sample pool: mountClip 4, `itemstandh 9 cm into stone_wall_2x1` on the middle-eastern woodworker s2 and s3.
- test_variance: home-a s2d2 0.65, home-b s2d2 0.61 and s3d3 0.61, home-c s2d2 0.71 and s3d3 0.61 (were 0.61, 0.54,
  0.53, 0.66, 0.52). Every household now draws from the same wider pool by corpus share, so households meet on the
  most common picks; the household weights do not reach `varyKit` or the flavor draws.
- check_interiors: overlap 7 (3), stairs 2 (0), bareFloors 12 (6), door 1 (2), floating 101 (110).
- Not checked yet on the branch: gen-test, dotnet build.

Next for the branch: give `varyKit` and the extras the household (comfort to rugs and pelts, wealth to marble and
blackwood, size to seats, clutter to repeats) so households part again; find the Plains itemstandh into stone walls
(likely a set's ledge on a stone wall now that more sets go in); look at the new overlaps, stair zones and bare floors
in `check_interiors` rows; then gen-test, dotnet build, merge.

### Session of 2026-11-11 (stopped early for usage; branch tip 9a5e052)
Done:
- e9892e4 merge of main (0604748, creative sets from the full corpus). Conflicts in `kitbash.js`: the fitter and the
  hopeless test keep `can` (pieces.js decorOk); main's creative-set filter by `a.from` is kept, read against
  `PB.buildReach(ctx.biome)` so it is the same rule as decorOk. Bundles taken from main.
- 9a5e052 (WIP):
  - `generate.js` `settle` took out every decor piece past the village's biome after the decorator had placed it
    (`ord.indexOf(P.needs(name)) <= limit`). On the branch the decorator draws decor from any biome, so a Meadows home
    lost its Swamp chest, a Dvergr table and the chairs that went with it (home 303 s2d2: no table, chest or chair at
    all). It now reads `P.decorOk`. `bedIfNone` counts any bed (decorOk). `decorate.js` `tplSwap` reads decorOk.
  - `decorate.js` household taste: `tasteD(n, P)` weighs the kit (comfort to pelts and furs over jute and straw;
    wealth to blackmarble, blackwood, oak, Dvergr table, chair02 and chair03 over plain wood; size to benches over
    chairs and stools); `chooseKit` and `varyKit` take the household; `varyKit` draws from a stream salted with the
    household's traits; a tidy household keeps the building's matched pick more often (`keep` 0.15 + 0.4 tidy) and
    what the house shows already weighs less the tidier it is; `fill` repeats an extra more readily the more cluttered
    the household (0.3 + 0.45 clutter in place of 0.5). Weights only.
  - `decorate.js` `outside`: heaps go clear of decor already set out (a Meadows smithy's coal pile went into the
    woodshed's wood stack once coal piles were allowed in the Meadows).
- Changes in other tracks' files: `generate.js` `settle` first line and `bedIfNone` bed test (biome rule only).

Measures (before is the merged branch e9892e4, after is 9a5e052):
- test_variance means: home-a s2d2 0.61 to 0.51, s3d3 0.41 to 0.43; home-b s2d2 0.60 to 0.71, s3d3 0.59 to 0.52;
  home-c s2d2 0.64 to 0.58, s3d3 0.61 to 0.47; hall 0.44 to 0.47 and 0.50 to 0.42. home-b s2d2 fails.
- check_interiors, 3 seeds, 702 designs, main 0604748 against the branch with the settle fix (before the outside fix):
  bareFloors 6 against 3; overlap 5 against 7; stairs 0 against 1; door 3 against 2; floating 114 against 107;
  check:overlap 0 against 3; check:stability 0 against 1. With one seed (234 designs): overlap 1, stairs 1, door 2,
  bareFloors 0.

Half done:
- home-b s2d2 (seed 202): the kit bed is `ashwood_bed` (1.6 m wide) for every household and the layout is far-sleep
  (lib/layout.js) with three beds side by side; `placeTable1` finds no spot for any table (rejections: nearWall 46,
  structure 68, fire 41, bed-table meter 37), so all six households show beds, chests and torches only. The fix is in
  the table fit or the bed row (decorate.js `furnishPlan` home branch, `placeBeds`, `placeTable1`), never a cap.
- check_interiors rows new on the branch (all appear because decor of other biomes now stays): smithy Meadows 277 and
  375 wood_stack / coal_pile (fixed by the outside change, not re-run); sawmill Black Forest 438 wood_stack (the
  woodshed's, `generate.js` `woodshed`, outside the gable at x -6) against a fill barrel at -4.5 indoors (decorator
  boxes 2.46 x 2.31 for wood_stack; check if the wall stands between them, likely a measurement artifact of the
  audit's boxes); tavern and farm Black Forest 330 and 600 Fiddlehead / Fiddlehead (two sill or yard plants on one
  spot, details.js `SILL_PLANTS` or yards.js `FLOWERS`); check:overlap tavern Meadows 223 and temple Meadows 665 (one
  doubled piece), barn Swamp 454 (piece_chest_wood in wood_wall_half, a BK-cabinet clip not marked); check:stability
  smithy Black Forest 384 (a wood_pole would fall); stairs tower Black Forest 708 (piece_bench01 at a stair).

Next steps, in order:
1. home-b s2d2: make the table fit beside the bed row (or the bed row leave the table's place), then test_variance.
2. The rows above, one by one (scripts used: /tmp/h1-var/aud.js prints one design's audit and checks).
3. The Plains sample pool's itemstandh 9 cm into stone_wall_2x1 (middle-eastern woodworker s2, s3): not started.
4. D-132 in lib/audit.js and the pool gate: nestBroken and lineage reported only; a gate that the plan's shape family
   stays between stages. Not started.
5. Quick checks (test_structure, Norse Meadows pool, Plains sample pool, test_variance, check_interiors one seed),
   then the full run, gen-test, dotnet build, merge. Then the essentials task below.

## Open problems
- The 16 most used prefabs still make 77 to 80 % of decor: item stands (food and drink are put on flat stands), wall
  torches, barrels, chests, candles. The visible essentials (beds, tables, seats, rugs, fires) are still the
  decorator's picks.
- Engine time is up about a third against main before this work.
- `BlueprintEdits.cs` rewrites board saves without the `#VillheimClips` and `#VillheimSets` sections (a mod change).
- D-098 in the Decisions tab: the pool audit handling is built (e44db1e).

## Next: essentials from the corpus (as briefed, not started)
Tyler on the lab page: "the same general beds. The same types of rugs. The same fires. The same tables and chairs. The
same torches... Always the same tables. Candles. Dandelions on sills. Same exact lox rug."

1. Find every place `lib/decorate.js` (and `lib/kitbash.js` slot fills, `details.js` window boxes and sills, yards)
   picks one prefab per biome or per room by rule (KIT lists, `pick(KIT.x)`, sill plants, rug choice, table, chair,
   bench, bed, torch, candle) and replace it with draws weighted by what builders use in that room kind and culture
   (`data/kitbash-interior.json` decor counts by anchor and room, `data/interior.json` items, the creative sets),
   varied by household and village, deterministic per seed. (The branch above starts this for rugs, seats, tables,
   banners and sills; beds, chests and candles are still one pick per building.)
2. Make the essentials themselves sets from the corpus: bed corners as builders make them (beds with pelts,
   nightstands, chests at the foot, canopies and built frames where the corpus has them), dining sets, hearth seating,
   so the d1 essentials already look built by a person; keep beds first at d1 and the additive stages (d1 in d2 in d3).
3. Measure what Tyler sees: per room kind, the distinct prefabs among the 20 most visible pieces (beds, tables, seats,
   rugs, lights, sill and table items) and the share of rooms using the single most common choice for each; before
   and after; render plans and four views (`lab/render_views.js`) of a Meadows home, a Plains house, a Swamp tavern and a
   Meadows hall, and judge them against the corpus.
Fire and light placement belong to the hearths and lighting helper; item stands to the stands helper.
