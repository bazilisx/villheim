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

## Open problems

- Hard fails left, by owner: narrow wings and loft walkways in the structure (corpus-rooms H1, 11 showcase designs;
  track D); wood_fence as railings indoors and on towers (corpus-rooms H5, catalog H1; track D, D-164); floats of
  3 to 10 cm on stools, flat stands and one bed in track F's measure (`settle` reads them as standing; tracks F and
  G to agree on the foot height of the stool model and of posed flat stands); a Dvergr wall lantern turned with its
  side to a corner wall in track A's measure while track F's wallTurn passes it (06); a flat stand over an edge in
  the tower (14, track G's pose).
- Hubs are furnished by `lib/hub.js` and the interior library, without room intent; they hold most remaining
  catalog fails (01 to 03).
- Built furniture seldom fits homes: generated walls carry a window every bay or two, so plain stretches of 2 to
  4 m are rare (track D and H facade rhythm).
- Large homes rarely get a hearth: the 4 by 3 m hearth seldom fits under the vent and the fire pit stands in
  (catalog item 6).
- Beds under eaves in lofts face walls the room reader takes from beams (09).
- The furnishing is sparse in small rooms by design (corpus density); Tyler may want more at d3.

## Proposed Decisions rows

1. Room intent as the default furnishing (`ctx.intent`), the interior library's corner sets, vignettes and chest
   stacks off. Options: (a) as built; (b) keep the library sets as a household trait. Recommend (a).
2. Loose furniture that blocks a way is left out instead of moved (D-148). Options: (a) as built; (b) move it as
   before. Recommend (a).
3. Seats per building held to the corpus p90 of that seat prefab, so a hall seats with chair03, stools or benches
   and rarely with chair02 (p90 3). Options: (a) as built; (b) no seat cap in halls. Recommend (a).

## Next steps

- Council round one: suggested candidates `council-tower-mt-frankish-norman-s3d3-31` (all four scored lists pass;
  F's float on two stools), `council-smithy-md-steppe-s3d3-614` (passes all but a lantern turn), and
  `council-home-mt-swamp-s3d3-95` (home; structure H1 only). Make them with
  `node lab/council_candidate.js --type tower --biome mt --culture frankish-norman --seed 31` and the like.
- Move the hub's interior onto room intent.
- Architecture audit (track H's four scripts) into the candidate script.
