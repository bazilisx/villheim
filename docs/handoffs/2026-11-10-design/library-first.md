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

Half done (all finished in the next session, below):
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

Next steps as they stood (done, see the next session):
1. home-b s2d2: make the table fit beside the bed row (or the bed row leave the table's place), then test_variance.
2. The rows above, one by one (scripts used: /tmp/h1-var/aud.js prints one design's audit and checks).
3. The Plains sample pool's itemstandh 9 cm into stone_wall_2x1 (middle-eastern woodworker s2, s3): not started.
4. D-132 in lib/audit.js and the pool gate: nestBroken and lineage reported only; a gate that the plan's shape family
   stays between stages. Not started.
5. Quick checks (test_structure, Norse Meadows pool, Plains sample pool, test_variance, check_interiors one seed),
   then the full run, gen-test, dotnet build, merge. Then the essentials task below.

### Session of 2026-11-11, second (branch tip 46f700e, pushed)
Commits: 68c722a beds per household; f4b5f40 interior fixes; 2e74b7e pool gate after D-132; 46f700e D-127 relief clips.

Beds per household (`lib/decorate.js` `bedTaste`, `placeBeds`, `placeTable1`; weights only, D-126, D-136 rates from
corpus counts in the research branch's `data/culture-corpus/summary.json`):
- Each household draws its own bed from its own stream: bed 0.5, piece_bed02 0.6 (910 and 1,096 uses), ashwood_bed
  0.05 (none in the counts; the kit's usual floor so it can show), times `flavorD` and the household's taste (wealth to
  piece_bed02, plain to bed).
- Beds in a row or apart: side by side in 21 of 71 norse builds with beds (0.3), 45 of 70 forest cabins (0.64), times
  0.7 + 0.6 tidiness. Apart puts the next bed on another wall or well along this one (homes and bedrooms; bunk rows
  stay rows).
- A foot chest past the d1 essential at 0.3 + 0.36 clutter (34 of 71, chest by a bed); a rug beside or under a bed in a
  home at 0.42 x (0.5 + comfort) (30 of 71). Both are extras, so a library set by the bed moves them aside.
- `placeTable1` scores a spot down when no seat fits beside it (a table squeezed between the fire and a wall had no
  seat on either side and the house went without a table). Home-b seed 202 still has no table for most households: the
  56 m2 room is 8 x 6 m with the fire ring, a cauldron and the bed; the crafts household gets one.

Interior fixes (`check_interiors` rows new on the branch):
- `yards.js`: three yard flowers spaced by their spread; two of one kind keep out of each other (Fiddlehead pairs).
- `kitbash.js liveIn`: the jitter reads neighbors by the audit's furniture box as well as the solids (a barrel turned
  into a chair, tavern Meadows 220).
- `kitbash.js` fitter: two slots of one set filled with one name in one place are one piece (KC-126 doubled beam,
  tavern Meadows 223); furniture without a decorator size is tested by the audit's catalog box (furnClip, onStation:
  KC-148's mead ketill 29 cm in a cauldron, Plains home-b s2).
- `kitbash.js stalls`: the stalls clear 0.3 m past the end partitions (a chest into a half wall, barn Swamp 454).
- `kitbash.js dropFalling`: a set's building piece the stability check would let fall goes (KC-147 hanging pole,
  smithy Black Forest 384).
- `kitbash.js vignettes`: a stair along the wall counts with 0.6 m round it (bench at a stair, tower Black Forest 708).
- `decorate.js auditOne`: stands, signs and banners resting on a shelf are tested against the building's shell by the
  audit's mountClip measure (itemstandh 9 cm into stone_wall_2x1, Plains hall s3 and woodworker s1).

Pool gate (`lib/audit.js`, D-132): nestBroken and lineage are reported only (`report.reported`, printed as "reported
(never gated, D-132)"). The gate now checks: richness (pools of six lines or more), homeAlike, shapeChange, furnClip,
stacked, overWin, stairFoot, stations, mountClip, hang, loose, doorway, onStation, intoWall. shapeChange: a line whose
plan family changes between s1, s2 and s3, the family read from the ground floor walls (angled when over a quarter
stand off the 90 degree grid: octagon, round; square otherwise: rectangle, L, T, U, cross); the plan's name from the
design name is reported beside it (`lab/audit_pool.js` prints it per line). Fires, decor and furniture moving between
stages (the hearths branch) no longer fail anything. setShare floor 0.36 to 0.34: the corpus bed rates put Norse
Meadows at 0.355 (0.371 with the earlier rates, same pool). Docs: BLUEPRINT_LAB.md gate table.

D-127 (Tyler: "if the corpus builders do it, its allowed and you should mirror their work"). Audit and fitter tests that
refuse what corpus builders do, with the corpus depth or frequency (`data/kitbash-interior.json` decor clip medians and
the mined sets' clip lists):
1. Done: wall item stands into a wall's relief, 5.3 cm median over 15 mined sets with the stand clipped into the wall
   (max 28 cm; 7.7 cm median, 12.5 cm 90th percentile over 4,212 stands). `decorate.js HUNG_CORPUS`, `clearOfRelief`,
   `auditOne`; past 1.5 cm the piece carries p.wclip (#VillheimClips, D-098). Norse pool: 43 stands marked.
2. Done: wall torches in a wall's relief, 8.6 cm median over 808 torches in 238 builds (23 cm 90th percentile). 54
   torches marked in the Norse pool. (The pool audit does not measure torches.)
3. Open: chest pairs past the 12 cm furniture limit (audit furnClip 12 cm; decorate audit 3 cm between two sets'
   chests): piece_chest_wood into piece_chest_wood in 17 mined sets, median 11.4 cm, max 27.9 cm.
4. Open: chests into walls past 12 cm (decorate SHOWS_MAX 12 cm, audit intoWall 15 cm): piece_chest_wood 53 sets,
   median 12.1 cm, max 61 cm; piece_chest 18 sets, median 14.2 cm; piece_chest_blackmetal 14 sets, median 14.2 cm.
5. Open: signs on chest fronts and other pieces (`mountOk` wants a plain wall behind): sign rests on another piece 371
   of 4,450 signs; sign clip median 8 cm, 90th percentile 18.7 cm; itemstandh into sign 10 sets, 3.8 cm.
6. Open: wood_ledge in relief, median 5 cm over 144 ledges in 10 builds (90th percentile 40 cm); banners 18.5 cm
   median over 292 (audit allows the cloth 3 cm); dvergr lanterns 18.8 cm median over 462.

Measures (before 9df345e, after 46f700e):
- test_variance means (closest pair): home-a s2d2 0.51 to 0.47 (0.81), s3d3 0.43 to 0.41; home-b s2d2 0.71 to 0.53
  (0.83), s3d3 0.52 to 0.51 (0.84); home-c s2d2 0.58 to 0.50, s3d3 0.47 to 0.58 (0.89); hall 0.47 to 0.38 and 0.42
  to 0.40. All means under 0.6; closest pairs still reach 0.76 to 0.89 in homes.
- check_interiors, 3 seeds, 702 designs (main 0604748 / before / after): overlap 5 / 7 / 1; stairs 0 / 1 / 0;
  check:overlap 0 / 3 / 0; check:stability 0 / 1 / 0; bareFloors 6 / 3 / 4; door 3 / 2 / 2; floating 114 / 107 / 110.
  The rows left are on main too (home Mountain 139 torch by a bench, tavern doors 229 and 336, tower top floors).
- Pools: Norse Meadows pass (14.6, 0.351, 1.58; nestBroken 0, shapeChange 0); middle-eastern Plains pass (was mountClip
  4, then furnClip 2 and onStation 2 from the merged creative sets; now 12.1, 0.477, 1.38). Black Forest pool not run.
- test_structure: 36 hold. Engine time in check_interiors 204 to 287 ms per design at load average 5 to 6 (other
  helpers running); the seat test in `placeTable1` adds fits calls per table spot, not measured alone.

Changes in other tracks' files: none this session (generate.js `settle` and `bedIfNone` as listed above).

Open: home-b seed 202 still tableless for five of six households (room too full, see above); the full check run,
gen-test and dotnet build at integration; D-127 items 3 to 6.

Next task: the essentials task below (beds, tables, seats, rugs, chests, candles weighted by corpus counts per room
kind and culture, D-136), with D-127 items 3 to 6 in the same pass.

## Open problems
- The 16 most used prefabs still make 77 to 80 % of decor: item stands (food and drink are put on flat stands), wall
  torches, barrels, chests, candles. The visible essentials (beds, tables, seats, rugs, fires) are still the
  decorator's picks.
- Engine time is up about a third against main before this work.
- `BlueprintEdits.cs` rewrites board saves without the `#VillheimClips` and `#VillheimSets` sections (a mod change).
- D-098 in the Decisions tab: the pool audit handling is built (e44db1e).

## Next: essentials from the corpus (as briefed; the first pass is in "Essentials" below)
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

## Essentials (2026-11-11, branch design/wip-essentials from 2aa8836)
Commits: 684d0ad (weights, turns, wall seats, table dressing), ca36476 (stacks, D-127 chest clips, kit draws, barrels,
recipe biomes, stand cap), and the commit with this section (audit and stacking fixes from check_interiors, docs).

Corpus data (D-136: the counts set the targets): the research branch's `data/culture-corpus/summary.json`, written into
`lib/decorate.js` `CORPUS_CULT` by `lab/culture_kinds.js` (per culture group: furnished buildings, top prefabs per kind,
onTable, the rel and relx shares; 'all' sums every group). `CULT_GROUP` maps the generator's cultures to the groups
(baltic has none and uses 'all'). A group's numbers are blended with the whole corpus by n / (n + 40) furnished
buildings, so small groups (saami 2, slavic 1) count for little.

Done (`lib/decorate.js`, `lib/kitbash.js`; weights only, D-126):
- Draws: `chooseKit`, `varyKit` and `bedTaste` weigh each prefab by the room kind's share in `data/interior.json` plus a
  floor of 0.04 (it was 0.15 to 0.3, which put hare and straw rugs level with deer and fur), times `corpusTilt` (the
  culture group's share of the kind against the corpus). Chests and wall lights are now drawn per room (`varyKit`), as
  rugs, seats and tables were. The nook chair and the foot bench take the room's own pick (they were fixed
  piece_chair02 and piece_bench01).
- Library: a rug slot draws by the same weights (`fillSlot`, `corpusPick`; it was a uniform draw over 12 rugs). The
  hand-made kits (BK-) draw their chairs, benches, pine table and chests by the same weights, one draw per kit
  (`builtPick`, `BUILT_SWAP`: only prefabs of about the same footprint). Mined and creative sets keep their source's
  prefabs.
- Table tops: a table is dressed at the culture's `tablesDressed` rate (41 % norse), by the household's clutter, and
  what lies on it is drawn by the corpus onTable counts among itemstandh, treasure_stack and Candle_resin
  (`dressTable`, `topWeights`; candles were on most tables). The BK kits' table items follow the same rate.
- Barrels in living rooms only for households that keep them: 22 % of furnished corpus buildings have barrels, times
  0.6 + 0.8 clutter (`keepsBarrels`, the decorator's barrel extra and rows and the BK kits). Taverns, stores and work
  buildings keep theirs.
- Seats: `wallSeat` extra (a chair or bench along a wall away from tables, by a station or a chest), and a table asked
  for more than two seats gets 40 to 90 % of them.
- Turns (`kitbash.js turnLikeCorpus`, run in `liveIn`): tables (with what lies on them and the seats drawn up),
  seats and rugs turned 12 to 30, 40 and 45 degrees as many as bring each design to the culture's relx share times
  0.5 + clutter; a turn that makes a new problem is taken back and two more angles tried. Library pieces count (most
  tables and seats come from the library); hung pieces and pieces marked as clips stay.
- Stacks (`kitbash.js stackChests`): a chest of the same kind on a chest within 1.2 m of a wall, 0.3 m clear above, as
  many as bring the design to the culture's chestsStacked share times 0.6 + 0.8 clutter; never on a set chest framed
  by beams or posts, or within 1.8 m of a door (door lights go there later). `decorate.js audit` reads a chest on a
  chest as resting (the store rooms' own stacks were counted as floating before: check_interiors floating 50 to 5).
- D-127 items 3 and 4: `kitbash.js CHEST_PAIR` (piece_chest_wood into piece_chest_wood 11.4 cm, the median of 17 sets)
  and `CHEST_WALL` (into a wall: piece_chest_wood 12.1 cm over 53 sets, piece_chest and piece_chest_blackmetal 14.2 cm)
  in the fitter's solids test; the pair carries p.fclip for the pool audit (D-098); `decorate.js auditOne` lets a chest
  show into a wall to the same medians; `decorate.js audit` overlap lets the wood chest pair pass to 11.4 cm.
- `lib/audit.js`: wall stand middle cap (MID) is the higher 90th percentile of `itemstand|wall` and `itemstand|rafter`
  in `data/stands-corpus.json` heights (3.8 m with the stands branch's file; 2.4 m where the file is missing, as on this
  branch and the web page; `STAND_HI`). A sign on a chest's front (middle within 0.25 m of a storage box, no higher than
  its top) is read as a label and skips the sign height test (the corpus has 371 of 4,450 signs resting on another
  piece; mined set KB-023 puts one on a chest front, which failed the Plains pool with hang 6).
- `lib/pieces.js` recipe biomes: galdr table and its two upgrades, black forge, cooler and vise Mistlands; metal cutter,
  gem cutter, lava lantern, bone throne Ashlands (bamboogaming.net and metabot.gg recipe pages); mead ketill Ashlands
  as a guess (its recipe was not found); feasts by their food's biome (sailor's bounty Swamp).

Measures (`lab/essentials.js`, 216 designs: six kinds, six biomes, s2d2 and s3d3, three seeds; a floor stands in for a
room). Distinct prefabs / share of floors using the most common one, before (2aa8836) and after:

| Kind | Beds | Tables | Seats | Rugs | Lights | Chests |
|---|---|---|---|---|---|---|
| home | 3/67 to 3/64 | 5/39 to 5/50 | 8/35 to 9/41 | 12/41 to 11/40 | 10/69 to 11/69 | 5/91 to 6/65 |
| longhouse | 2/75 to 2/75 | 5/88 to 6/81 | 10/65 to 9/64 | 12/34 to 10/53 | 11/52 to 11/55 | 7/73 to 6/73 |
| tavern | 2/50 to 2/55 | 5/64 to 6/70 | 9/63 to 10/61 | 12/36 to 11/53 | 12/69 to 12/64 | 7/96 to 7/99 |
| smithy | - | 4/62 to 3/63 | 6/59 to 7/38 | 9/29 to 10/33 | 9/60 to 9/63 | 6/79 to 6/71 |
| workshop | - | 5/65 to 3/56 | 7/52 to 8/29 | 7/31 to 8/50 | 9/59 to 9/57 | 7/76 to 7/74 |
| storage | - | 1/100 | 2/100 | 3/50 to 3/33 | 6/63 to 6/60 | 7/87 to 7/86 |

The most common choice before was often a corpus rarity (hare and bog witch rugs, the butcher table, barrels as the
home chest); after it is a corpus favorite (piece_table, piece_chair, rug_wolf and rug_fur, piece_chest_wood), so some
top shares went up as the corpus has them. Tavern chests stay barrels (the bar).

Relations, before and after (corpus norse / all groups in brackets; definitions in `lab/essentials.js`):
tables turned 0 to 27.7 % (27 / 29); seats turned 12.9 to 38.5 % (41 / 41); rugs turned 8.3 to 27.4 % (30 / 30); rugs
layered 15.5 to 20.1 % (23 / 21); chests stacked 22 to 42 % (60 / 57); tables dressed 90.1 to 53.1 % (41 / 41, ours
counts the stands track's food on tables too); seats by a wall 31.9 to 36.1 % (41); seats at a table 60 to 57.1 % (28 /
25); seats by a fire 13 to 11.8 % (4 / 4).

Checks: test_structure 36 hold. Pools: Norse Meadows pass (14, 0.376, 1.81; before 14.6, 0.351, 1.58); middle-eastern
Plains pass (12.4, 0.478, 1.56; it failed hang 6 on KB-023's chest-front sign before the audit change). test_variance
means (closest pair), before to after: home-a s2d2 0.47 (0.81) to 0.40 (0.60), s3d3 0.41 to 0.42; home-b s2d2 0.53
(0.83) to 0.52 (0.77), s3d3 0.51 (0.84) to 0.53 (0.71); home-c s2d2 0.50 (0.76) to 0.52 (0.67), s3d3 0.58 (0.89) to
0.48 (0.64); hall 0.38 to 0.37 and 0.40 to 0.40. check_interiors, one seed, 234 designs (before / after): overlap 1 / 0,
floating 50 / 5, stairs 1 / 2 (new: a bed by the stair, home Mistlands s3), door 2 / 2, bareFloors 1 / 0, check:space
0 / 1 (stall Mountain s3, 36 % free).

Creative picks left out for going into no room (`lab/creative_fit.js --drop`, library written with `NODROP=1 node
lab/creative_sets.js x /tmp/lib.json`): 13 of 49 now fit at least once, the same 13 before and after the chest clip
change in this session (KC numbers of that library: picks 197, 4, 11, 30, 50, 151, 48, 257, 269, 285, 178, 279, 280).
The fitter's reasons summed over the probe: audit (rests, visible clip) 65,072, off the room 41,475, clips something
placed 39,935, hung on a window 16,174 (signs on chest fronts, item 5), furnClip 14,852. They are still in `DROP`;
bringing them back needs the pictures and the pool.

Renders (`/tmp/ess-renders`, not committed): `after-views-*.png` and `before-views-*.png` (lab/render_views.js) and
`after-households-*.png` (lab/households_sheet.js) for home Meadows, home Plains, tavern Swamp, longhouse Meadows, s3d3
seed 11.

Changes in other tracks' files: none. `varyKit` now draws `k.wallLight` per room; `placeLights` (hearths track) reads it
unchanged.

Open: seats at tables (57 % against 25 %) and by fires (12 % against 4 %) are still high (the BK dining kits and the
layout templates seat every table); engine time 226 to 344 ms per design in `lab/essentials.js` (other helpers ran at
the same time, not measured alone); the 13 creative picks above; sills come from `lib/details.js` window boxes (not in
this track).

Next: essentials as sets (bed corners with pelts, nightstands and foot chests; dining sets with fewer seats and some
tables set against a wall; hearth seating); signs on chest fronts and other pieces in the fitter (D-127 item 5, 371 of
4,450 signs); ledges, banners and Dvergr lanterns in relief (item 6).

## Essentials, round 2 (2026-11-11, branch design/wip-essentials from 45d4e62)
Commits: cb9bb0c (tables, seats, rugs, chests and barrels by corpus counts, and the pool fixes below), 1508ab2 (this
section).

What the renders showed, checked against the pieces (lab script output, home Meadows s3d3 seed 11 and tavern Swamp
s3d3 seed 11):
- The "round dining set in the alcove" in all six households is the fire pit with its cooking spit and the beam kerb
  (fire_pit and piece_cookingstation at -4, 0). The household's real table (piece_table_round at -0.8, 2.3) stood in
  the same spot in five of six households.
- The plants household's "four beds" are piece_chest_blackmetal (its chest pick; the plan render draws it as a dark
  frame). Its one bed, piece_bed02, is upstairs.
- The tavern's "wall seats in corner clusters" are piece_chest_barrel: 20 barrel chests on the ground floor (store rows,
  stacks, the kitchen and serving kits), turned up to 50 degrees by liveIn. The crafts household's "chairs in the
  corners" in home Meadows s2d3 seed 7 are barrel chests too (7 with stacks).
- The bare half of the big home room is the half by the door. Tables, seats and chests stood 6.4 to 7.3 m from the
  nearest door at the median against 3.7 to 4.8 m in the corpus (data/interior.json items door quartiles).

Done (`lib/decorate.js`, `lib/kitbash.js`):
- Corpus quartiles read at a household draw (`corpusAt`, `roomU`): data/interior.json items' nearest-fire and
  nearest-door distances, kept in data/interior-lite.json as `fireQ` and `doorQ` (`lab/interior_lite.js`).
- Tables: each table draws its distance from the fire (`tableFireAt`; the plans' 'fire' zone held every table 2.4 to
  4 m off, short of the corpus first quartile of 3.7 m) and from the door (`doorWant`), for the decorator's tables and
  the library's dining sets alike (`tableZone` wraps the plan's table bias). The 2.7 m keep-off from doors is 1.6 m
  (0.6 of the corpus first quartile). The bed-side bias is 0.3 in a room with no bed. `spreadTables` keeps the first
  table placed (it kept the one nearest the room's middle) and any side table nobody sits at.
- Seats: tables are seated as often as the culture's corpus tables (`corpusRate` ts: 51 % norse, 44 % all); an
  unseated table leans to a wall. Library dining sets keep 1 to 4 seats (weights 0.3, 0.3, 0.25, 0.15, about 2.2 seats
  per seated table as in the corpus) or none at the same rate (`diningSeats`); taverns and halls keep at least one.
  Seats go to the side away from the fire first. `wallSeat` puts a bench (generate.js tidyFurniture takes out a lone
  chair) at the corpus door distance, off the fire and 2.2 m from other wall seats.
- Extras by corpus counts per room kind (`kindNeed`: share times count summed per kind, scaled by the room's area to
  the kind's median room; the home room of 97 m2 holds 5.6 rugs, 4.3 seats, 3.9 chests, 1.2 tables): an extra whose
  kind the room is short of weighs up to four times as much. Rugs no longer count toward the density target (the
  learner's `furn` leaves them out). A free rug goes under a lone seat, chest, station or bed on the barest floor at
  the corpus door distance, drawn by the room kind's rug shares.
- Tavern barrel chests by household (`keepsBarrels`, the 22 % rule; corpus tavern rooms: barrel chests in 14 %, plank
  and iron chests in 24 % each). The bar counter keeps its two.
- A table the household keeps (`corpusRate` th: 68 % of norse furnished buildings have one; new key from
  `lab/culture_kinds.js`): `tableSure` tries every cell and wall, a seat or none, three tables, then 0.6 m from a bed
  (`TABLE_BED_TIGHT`, see the proposed row below), then lets extras give way. A home sets its table before the
  cauldron's butcher table. Homes with a dining table, 108 homes (6 biomes, s1d2, s2d3, s3d3, 6 households, seed 7):
  39 before, 53 after.
- Pool fixes: round tables are not turned by `turnLikeCorpus` (their box swung into the chairs); the turn finds seats
  by the catalog role where the furniture list has no entry; `dvergrprops_chair` is out of `BUILT_SWAP` (its solids
  reach into the sets' tables).

Measures (`lab/essentials.js`, 216 designs, three seeds; corpus norse / all in brackets), before (45d4e62) and after:
seats at a table 57.1 to 45.2 % (28 / 25); seats by a wall 36.1 to 45.6 % (41); seats by a fire 11.8 to 11.0 % (4);
tables with seats 89.8 to 74.7 % (51 / 44); wall seats with another within 1.2 m 2.8 to 1.3 %; table to fire quartiles
3.76 / 4.81 / 6.82 to 3.76 / 4.81 / 6.79 m (corpus 3.73 / 7.44 / 14.94); table to door median 7.29 to 6.37 m and chest
to door 6.39 to 5.72 m (one seed before; corpus 3.75 and 3.69); rugs 537 to 612; rugs layered 20.1 to 14.1 % (23 / 21);
seats 1,006 to 827; chests 2,431 to 2,107; tavern floors using barrel chests 99 to 71 %; beds above the main floor 49.7
to 50 % (64 / 60), on a fire's storey 50.3 to 50 % (48 / 45), side by side 7.2 to 9.7 % (21 / 20, this file's reading);
bare ground floor (points over 2.5 m from anything standing) 4.8 to 4.7 % mean. Beds already sit in sleeping rooms and
upstairs at the corpus rates; placeBeds is unchanged.

Checks: test_structure 36 hold. Pools: Norse Meadows pass (14.7, 0.352, 2.12); middle-eastern Plains pass (12.3, 0.453,
1.4). test_variance means (closest pair), before to after: home-a s2d2 0.40 to 0.38 (0.56), s3d3 0.42 to 0.39; home-b
s2d2 0.52 to 0.50 (0.64), s3d3 0.53 to 0.55 (0.73); home-c s2d2 0.52 to 0.45 (0.68), s3d3 0.48 to 0.46 (0.75); hall
0.37 to 0.35 and 0.40 to 0.41. check_interiors, one seed, 234 designs (before / after): overlap 0 / 1 (a ground torch
on a plank chest, tavern Swamp fen-folk s2d2), floating 5 / 6 (stacked barrels in store rooms), stairs 2 / 2, door 2 / 2,
check:space 1 / 0.

Renders (`/tmp/ess2-renders`, not committed): `views-*.png` and `households-*.png` for home Meadows, home Plains,
tavern Swamp, longhouse Meadows (s3d3 seed 11), and `households-home-meadows-s2d3-7.png`.

Changes in other tracks' files: data/interior-lite.json gains `doorQ` and `fireQ` per item (additive, rebuilt by
lab/interior_lite.js; the other fields are unchanged).

Open: seats by a fire stay at 11 % (halls' fire seats and long-wall benches, `placeFireSeats`); tables stand nearer
the fire and farther from the door than the corpus (library sets rank floor spots with noise and the plan's other
zones); rugs layered fell below the corpus; seats per design fell with the dining sets' seats; lights and item stands
run above the corpus counts per building (hearths and stands tracks).

Next: more seats and rugs by the corpus counts where the room has floor (rows of chairs along walls, rugs under
benches), seats by stations; bring rugs layered back to the corpus rate.
