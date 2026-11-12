# Track E, room intent (the builder): track record (2026-11-12)

Branch `design/wip-interiors` (from main 2e607cf; main merged in at bde196c and 6f98dd6, track F's branch at cde254b).
Brief: rewrite interior furnishing so every room has intent (purpose, focal point, zones, walking lines, sets that
belong together, supporting pieces, clutter that tells who lives there), picking pieces by look and corpus use from
the catalog; caps on repetition; Tyler's hard rules (passages, doorways, walkable rooms, wood_fence, woodpiles); and
the council's candidate script.

## What was done

| Commit | What |
|---|---|
| 40c8e45 | `lib/rooms_intent.js` (building plan, room intent, placing through the decorator's placers, caps per building), `data/intent.json` and `lab/build_intent_data.js`, piece roles (station add-ons, drapes on walls), the interior library's corner sets, vignettes and stacks off under intent, sets square, `lab/council_candidate.js`, `lab/council_checks.js` |
| 1eca9a3 | Passages kept clear inside rooms, sets moved whole or left out (never carried off), beds head to a wall, watch rooms, wall ledges capped |
| (cluster 3) | One seat kind at a long table; window planters as a household trait (later replaced by track H's program, 6f98dd6) |
| fa2dca3 | Stand items and armor stands from track G's `lib/standitems.js`; arms off dining tables |
| 1ec97c5 | Built furniture from track G's `lib/assemblies.js` per room program; game bundle |
| 6f98dd6 | Main merged (tracks F, H); room program from track H's `lib/program.js`; wall lights on `wallhang.plan()` slots; hub furniture on the floor top; drawer kit ledges on the chest lid |
| f9b56ad | No sign-clad counters; standing pieces settled; candidate script runs track F's checks |
| (last) | Supporting pieces sized to their room (D-163 principle); this record |

Files: `tools/blueprint-lab/lib/rooms_intent.js` (new), `lib/decorate.js`, `lib/kitbash.js`, `lib/persona.js`,
`lib/stands.js`, `lib/pieces.js`, `lib/layout.js` (one small rule, `moveOk`), `lib/hub.js` (furniture height),
`lib/build_engine.js`, `lab/build_intent_data.js`, `lab/council_candidate.js`, `lab/council_checks.js`,
`lab/test_sizes.js`, `data/intent.json`, `src/Villheim.Logic/Generator/lab.js` (rebuilt). Intent is on by default;
`ctx.intent === false` in `Decor.decorate` gives the furnishing of before.

## How it works

1. Building plan (`planBuilding`): one furniture suite per building. The table is drawn by how many tables corpus
   builders seat (`sets.json`: piece_table 640, round 358, oak 126, black marble 121, Dvergr 72), leaned by the
   household's wealth against the table's formality and by the culture group's own shares (`caps.json byCulture`).
   The seat is drawn from the seats builders put at that table (piece_table: chair02 42 %, chair03 24 %, bench01
   17 %), weighted by whether the corpus count per building can seat the building (a hall needs about 12; chair02
   has p90 3 per building). A bench joins only where it is 10 % or more of that table's seats. Bed and chest by
   corpus share, near the table's color and family. Light kinds: one lead (corpus share of buildings lit by each,
   culture, biome flavor, and kinds the suite rarely shares a room with weigh less), one to three kinds (corpus
   median one), candles in about one build in twenty and never with wooden standing torches (lift 0.23). Rugs: one
   or two kinds, or none (68 % of furnished builds have rugs). One banner color.
2. Room intent (`intentOf`, `furnishRoom`): the room's corpus kind (home, bedroom, dormitory, feast hall, throne
   hall, tavern hall, shrine, smithy, workshop, storage, kitchen, watch room) with its purpose, focal piece, zones
   and the story it shows; counts from `kinds.json` (p50 when present, scaled by the room against the kind's median
   room, capped at p90). Core sets first: the fire (hearth in halls and taverns and in 74 % of large homes), the
   table set with an exact seat count from the corpus seats per seated table, beds with their side pieces (a stool
   or barrel at the head at the corpus shares), the forge or workbench with one of each extension by corpus share
   (never two of one, never in front), store walls. A feast hall eats at one long table end to end down the long
   axis with the high seat at the head. Then supporting zones the household's traits ask for (sitting nook, gear
   corner, store corner, brewing, handwork, map table, games table, built furniture) until the room holds the
   corpus furniture per 10 m2 for its kind (median at d2, upper quartile at d3 by clutter), each away from the
   others (hot spots with plain floor between). Then lights (count from the kind's corpus lights) and the wall bay
   (banner pair at the focal wall, a row of one item stand prefab over a bed or chest), then vignettes (supper left
   mid-meal with one chair pushed back, drinks at the other hall tables, the head's chair by the fire with a drink).
   The room program from track H (`Program.room`) decides per room whether it keeps the household's lead light and
   rug or its own.
3. Caps (`capBuilding`, end of `Kitbash.apply`): each prefab to its corpus p90 per building (or per 100 m2 for large
   buildings), lights outside the building's kinds out, wall ledges two per building (D-166: hidden-menu pieces need
   a use), what stood on a removed piece goes with it.
4. Walking: narrow parts of a room (free run across under 3 m, along 4 m or more) are passage zones kept clear.
   With intent, `lib/layout.js openWays` and `clearLanes` move only a group that holds a bed, table or station (with
   its set, as each set carries one `kb` key); a loose seat, chest or stand that blocks a way is left out (D-148).
5. Stand items and armor stands: `persona.dressStands` asks track G's `standitems.pick` for every stand (one ledger
   per building, homes keep home caps) and `standitems.armor` for every armor stand (`p.info`).
6. Built furniture: `assemblies.find/place` per room kind (hutch and pantry shelf, dresser and armor alcove, keg rack
   and drink shelf, tool wall, labeled storage), against a plain wall stretch in the suite's family, kept off doors,
   stairs, passages and walking lines, no header under 2.5 m, no recipe clad in signs.

## Findings by principle (Tyler's examples are one instance each)

- **Pieces chosen by look and purpose.** Before: seats per room from a per-room kit draw (`varyKit`), so one room mixed
  chairs, stools, log benches and black marble benches; the library added sets by name. Now one suite per building
  from the corpus table sets. Station add-ons were seats by name (`/bench/` matched `workbench_ext1`) and galdr
  add-ons tables; fixed in `lib/pieces.js`. Drapes on walls were read as doors. Applies to every seat, table, bed,
  chest, light, rug and banner kind.
- **Repetition capped.** Every prefab now has a per-building cap from the corpus; light kinds held to the plan.
  Showcase log benches went from 8 in the longhouse to 0 (none drawn); wood_ledge from up to 24 to 2 or fewer.
- **Sets that belong together.** One seat prefab per table (corpus-rooms item 2 and outside-study item 5 pass on every
  non-hub design but one), beds with side pieces, extensions one of each beside their station, the long feast
  table, sets moved whole or not at all, sets kept square (only loose chairs turn).
- **Every space walkable.** Passage zones, door zones as before, sets never carried to purposeless spots; the
  structure's own narrow wings remain (corpus-rooms H1, track D).
- **A piece sized to its space** (D-163, Tyler 2026-11-12: wood stacks "way too large" by an indoor hearth). Wood
  stacks and piles stay outdoors (lib/decorate.js `at: 'out'`, as before). Every supporting piece and built recipe
  is checked against its room (`sizedFor`): footprint at most a tenth of the floor (a recipe 12 %), no large or huge
  piece (catalog size class) in a room under 25 m2 beyond its core set; walking lines and passages stay clear as above.
- **A program per room and per building.** Suite, lights, rugs and banner per building; per room lead or own from
  track H; zones by household traits (never professions).

Audit totals, designs 04 to 16 (13 non-hub designs; main 2e607cf against f9b56ad, same seeds, game rules, one try):

| Audit | Points before | Points after | Designs passing (16) before / after |
|---|---|---|---|
| corpus-rooms (track B) | 1,164 | 1,257.5 | 2 / 5 |
| catalog, measured items (track A) | 989.5 | 1,062.5 | 7 / 9 |
| outside-study, measured items (track C) | 398 | 432.5 | 10 / 12 |
| stand items (track G, hard fails) | 27 of 32 designs failed (G's audit of main) | 15 of 16 pass | |

Per design: `/home/claude/work/e/final/*/scorecard.md` (scratch); the table above is from those scorecards and the
baseline run in `/home/claude/work/e/baseline`.

## Checks

- `node lab/test_structure.js`: all structure rules hold on 36 designs (after every cluster).
- `node lab/test_sizes.js`: 0 off by more than 10 cm (the test now reads a bed's length as it shows).
- `node lab/test_standitems.js`: 8 of 8; `node lab/test_program.js`: all pass.
- `tools/gen-test/run.sh tools/gen-test/requests.txt 1`: 5 of 5 the same byte for byte between the game's engine
  (Jint) and node; the longest took 34 s (s3d2 longhouse).
- Renders looked at for every showcase design and the candidates (`views.png`, `floor-*.png`).

## Measured disputes (overnight, 2026-11-12)

Each check disagreement was settled against the corpus blueprints (`/work/bp`, 2,657 files) and the fine meshes
(`/work/models/vhmodels/work/cache`). Scripts in `/home/claude/work/e/meas/` (scratch). By principle:

- **A piece stands where the game's placement lands, which the corpus shows per support.** Flat stands: piece_table
  +0.82 over its pivot (593 of 1,194), oak table +0.79 (621 of 702, model top 0.809), round table +0.80, level
  wood_ledge +0.03 (17 of 20; model top 0.0705), darkwood_beam +0.45 (19 builds; model top 0.4625), wood_beam +0.20,
  floors +0.10 (collider top). Placement fixed: `lib/persona.js` STAND_ON and the collider top for structure. Checks
  fixed: the float check reads floor colliders and furniture model boxes (`lib/wallhang.js` backing), and mountClip
  no longer counts what a flat stand stands on (`lib/audit.js`).
- **An upright item never lifts its stand.** Corpus stands sit at the support height whatever they hold (Carrot
  n 259, Mushroom n 110, TrophySkeleton n 67, CookedLoxMeat n 47, median -0.003 m). `lib/standitems.js` pose lifted
  them 5 to 8 cm; placement fixed.
- **Things on a fire.** Cooking station and cauldron stand +0.20 over a fire pit (252 of 256, 110 of 112) and +0.583
  over a hearth (116 of 123); the iron station stands on a hearth (257 of 259). Placement fixed in `lib/decorate.js`
  and `lib/hub.js`.
- **Stools and chairs.** piece_chair's and forge_ext4's model bottoms sit 7.1 and 4.2 cm over their pivots, as the
  corpus places them; the decorator lowers them (`lib/decorate.js` modelSizes). A chair tucked under a table edge now
  comes down onto the floor under it (`lib/persona.js`).
- **Facing.** Dvergr wall lantern: catalog, wallhang and the corpus agree on its +x side to the wall (69 % of 311
  builds; 35 % +x by nearest wall over 6,648); catalog H3 passes on every design. Wardrobe: +z to the wall (59 % of
  109 corpus wardrobes); the creative sets had it -z, fixed in `lab/creative_sets.js` and `data/kitbash-interior.json`.
  Thrones follow -z (56 % of 316 throne01). A bed standing free turns its head to the nearer wall.
- **A recipe is used only where it works in place.** Mined and authored assemblies are placed only where each
  free-standing piece rests on the floor or the recipe (AC-armor-alcove-16 left out the floor under its armor stand)
  and each wall-hung piece hangs on a wall, beam or post (AA-dresser-01's drawer-front signs had 5 of 9 parts of
  their backs on its side panels). Recipes with a piece outside the vanilla catalog are never used (AC-shelving-03
  FletcherTable_ext3_TW, AC-shelving-04 piece_chest_cargo; neither is among the game's 5,936 prefabs).
- **What holds a hung piece is any wall-like piece, whoever placed it.** Beams, posts and quarter walls added by a
  set or an assembly count as backing (`lib/wallhang.js`); a set's clip into its own quarter wall is written as a
  clip made on purpose (`#VillheimClips`, D-098).
- **A wall-hung station add-on goes on a wall.** forge_ext6 hangs on walls in 71 % of 416 builds and never in a yard;
  it left the forge yard and the open edge of a floor.
- **A building with no door is entered over any open edge.** The walk map seeded one cell, so the steppe smithy's
  forge was read as out of reach and removed; it now seeds every free edge cell (`lib/layout.js`).

## Open problems

- Hard fails left are the shell's (track D): game support and passages on the hubs (criteria/shell.md H1, H2),
  passages on 06 and 08, and 2 m wings that corpus-rooms H1 reads (wings 2 m wide and 6 m or more long in bedrooms,
  kitchens and lofts of 04, 05, 06, 08, 09, 12, 14).
- Hubs score under the mark on catalog (01, 02, 03) and outside-study (01, 03) points with no interior hard fail;
  their interior is `lib/hub.js` and the interior library, without room intent.
- Built furniture seldom fits homes: plain wall stretches of 2 to 4 m are rare.
- Large homes rarely get a hearth (the 4 by 3 m hearth seldom fits under the vent).
- Beds under eaves in lofts (09).
- AA-dresser-01 (signs as drawer fronts) and AA-weapon-rack-01 are authored recipes; the dresser is now never placed
  because its signs fail the wall check. The recipe needs its signs on the chest front.

## Proposed Decisions rows

1. Room intent as the default furnishing (`ctx.intent`), the interior library's corner sets, vignettes and chest
   stacks off. Options: (a) as built; (b) keep the library sets as a household trait. Recommend (a).
2. Loose furniture that blocks a way is left out instead of moved (D-148). Options: (a) as built; (b) move it as
   before. Recommend (a).
3. Seats per building held to the corpus p90 of that seat prefab, so a hall seats with chair03, stools or benches
   and rarely with chair02 (p90 3). Options: (a) as built; (b) no seat cap in halls. Recommend (a).

## Next steps

- Council candidates, all seven lists pass (`lab/council_candidate.js` now runs corpus-rooms, assemblies, wallhung,
  catalog, outside-study, shell and architecture): `--type tower --biome mt --culture frankish-norman --seed 31`,
  `--type smithy --biome md --culture steppe --seed 614`, `--type home --biome mt --culture swamp --seed 95`.
- Move the hub's interior onto room intent (D-154).
- Homes: hearths and built furniture on the program's plain wall stretches; the loft bed under the eaves.
