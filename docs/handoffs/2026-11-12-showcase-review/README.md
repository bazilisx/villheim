# Showcase review, 2026-11-12: plan and tracks

Source: `TYLER_NOTES.md` in this folder (Tyler's words, primary source) and the frames in `frames/`. Tyler's weights:
interiors about 80 % of what is wrong, roofs about 10 %, windows, sills and gardens about 10 %. His instruction: fix
the causes across the generator, and use the 16 buildings as test cases only.

## Problems by cause (from TYLER_NOTES.md)

1. **Pieces picked by name.** The generator knows a piece by its prefab id and a few tags. It has no record of
   how the piece looks (color, material, finish, glow, size), where it belongs (indoors, outdoors, rooftop, pasture),
   or how often builders repeat it. Result: black marble benches with light wood tables, a rune table in a wooden
   bedroom, green and cracked pots side by side, darkwood ravens indoors, wood_fence indoors and on towers, stone and
   grausten mixed.
2. **Rooms without intent.** Furniture is spread by slots and budgets. Rooms do not have a purpose, a focal point,
   a walking path or sets that belong together. Result: two tables side by side with mixed seats, lone stools, a log
   bench facing a mead barrel, a fire pit inside the door, chests stacked in corners, beds at odd angles.
3. **Repetition.** The same torch, candles, drapes, log benches and stacked chests in every building. No per-build
   cap from the corpus.
4. **Placement and attachment.** Signs stacked, signs and stands standing off walls, torches and a wardrobe and a bed
   turned the wrong way, darkwood beams hovering over half walls, chests clipping a throne stage, wood_ledge scattered.
5. **Space.** Halls and wings one floor piece wide (minimum is two, three or more for halls), a beam across a door,
   stairs blocking a hall, furniture on the walking lines, small plans (middle-eastern home), short walls (steppe tavern).
6. **Shell.** Gaps between wall tops and roofs, cross roofs misaligned and shifted, rooftop45 and woodroof_45 not
   joined, woodwall roof top 45 not aligned with the 45 beams.
7. **Windows, sills, gardens.** Sills not under windows and without a beam frame (see `frames/shot-c-sill-mockup.jpg`),
   plants falling through sills, single plants where builders use clusters, mixed plants without a theme, garden beds
   in two woods, gardens not meeting the wall.
8. **In the game.** No items on any item stand, the notice board not drawn right, the Meadows hub's upper parts falling.

## Tracks

Research tracks write data and docs only, so they run side by side. The code track owns the shell files.

| Track | Branch | Owns | Covers causes |
|---|---|---|---|
| A Piece catalog | design/wip-catalog | `tools/blueprint-lab/data/catalog/`, `docs/PIECE_CATALOG.md`, review sheet tab "Pieces" | 1, 3 |
| B Corpus rooms | design/wip-corpus-rooms | `tools/blueprint-lab/data/rooms-corpus/`, `docs/ROOM_STUDY.md` | 2, 3, 5, 7 |
| C Outside study | design/wip-outside-study | `docs/INTERIOR_DESIGN.md` new sections, `docs/handoffs/2026-11-12-showcase-review/outside/` | 2 |
| D Shell and space | design/wip-shell | `lib/generate.js`, `lib/styles.js`, `lib/layout.js` (hall widths, entries), `lib/details.js` (sills), `lab/test_structure.js` | 5, 6, 7 |
| Lead | main | mod side (`src/Villheim.Logic` outside Generator): stand items, notice board, hub collapse in the game | 8 |

After A, B and C report: **Track E, room intent.** A rewrite of interior furnishing around room purpose, focal point,
walking lines and sets, picking pieces from the catalog by look and corpus frequency. Owns `lib/decorate.js`,
`lib/kitbash.js`, `lib/stands.js`, `lib/persona.js`, `lib/yards.js` and `lib/landscape.js` plant picks. Its brief is
written from the three reports.

## Test cases

The 16 showcase designs (names in `TYLER_NOTES.md`, files in the profile's
`config/PlanBuild/blueprints/inspiration/generated/ingame/showcase`) are regenerated after each merge and checked
against every note Tyler made on them. A note is closed when the render shows it fixed and the cause is fixed in a
rule, never by a one-off patch for that building.

## Council (Tyler, 2026-11-12)

Tyler's plan: the helpers learn their areas, then one generates a building and the others audit, critique and refine
it until they agree it meets what they learned; then it goes to Tyler. At least two buildings per council member.

1. **Learn.** Tracks A to D as above. Each also writes `criteria/<track>.md`: a weighted checklist with tests, a pass
   mark and hard fails, grounded in its evidence.
2. **Build.** Track E rewrites interior furnishing from the A, B and C findings and generates a random s3d3 building
   (random kind, culture, biome, seed). Buildings are never edited by hand: each critique becomes a rule change and
   the building is regenerated from its seed, so every village gets the fix.
3. **Council.** A, B, C and D each score the building against their criteria and propose rule changes. An independent
   judge, a fresh helper who never worked on the generator, scores it from Tyler's notes and all criteria files.
4. **Quorum.** Every member at or above its pass mark, no hard fails, the judge passes it, and every building approved
   earlier still passes. Then the building is saved as a PlanBuild blueprint in Tyler's profile
   (`config/PlanBuild/blueprints/inspiration/generated/ingame/council/`) with its renders and scorecards. After 6 rounds
   without quorum, the lead takes the disagreement to Tyler.
5. **Target.** Five members (A to E) means 10 approved buildings, different kinds, cultures and biomes, all s3d3, plus
   the 16 showcase designs regenerated as a regression set. Tyler reviews them in the game.
