# Blueprint lab

Tools that learn how Valheim buildings are put together from Tyler's approved designs and other builders'
blueprints, then generate new designs, strip or furnish existing ones, check them, and draw them without the game.
Code in `tools/blueprint-lab/`. Built 2026-11-08 night. Nothing generated here is used by villages: see "Rules".

## What is where

| Part | File | What it does |
|---|---|---|
| Corpus reader | `lab/build_corpus.py` | Reads every PlanBuild blueprint (Tyler's, the 718 in PlanBuild's inspiration folder, the 12 permitted `hs_` keepers, the valheimians downloads), skips copies of the same build, joins the review sheet's Yes and No and the sort's type and subtype. Never reads the rest of the BiomeBlueprints pack. |
| Rules | `lab/learn.py` | Per design: category, culture, size stage, decor stage, palette. Then sizes per category, piece palettes per biome, furniture per room use and decor stage, where each furniture piece stands (against a wall, on a wall, in the middle; how far out; how high; which way it faces), and furniture groups (what stands next to what, and where). Writes `data/rules.json`. |
| Shapes | `lab/shapes.py` | Turns each build to its main axis, then sorts plans (rectangle, long, square, L, T, U, cross, octagon), roofs (gable, cross-gable, hip, half-hip, shed, flat, ring), walls (plank, half-timber, log, stone, stone base, marble, grausten), windows and gable ends, and counts which go together. Summary in `data/shapes-summary.json`. |
| Offsets | `lab/offsets.js` | How two pieces sit next to each other in the corpus, measured in the first piece's frame. The roof and gable rules below come from this. |
| Scorer | `lib/features.js`, `lab/train_scorer.py` | 21 numbers per design and a logistic regression on the review's Yes and No (206 kept, 455 dropped). Cross-validated AUC 0.70. `data/scorer.json`. |
| Pieces | `lib/pieces.js` | Size, shape, role and material for any prefab name; the biome a material first appears in. |
| Generator | `lib/generate.js`, `lib/styles.js` | A request (type, biome, culture, plan, roof, walls, size stage, decor stage, seed) to a design. |
| Cultures | `lib/styles.js`, `lib/generate.js`, `lib/gen_cultures.js` | The 14 approved village cultures, up to three per biome with weights, and their forms: round houses, crannogs, goahti, lavvu, yurts, Icelandic gable rows, courtyards with arcades, keeps, Svan towers, domed and drum churches, stave churches, sunken huts. Style guide and sources in `docs/CULTURE_STYLES.md`; overview pictures in `docs/cultures/`. |
| Decorator | `lib/decorate.js`, `lab/learn_interior.py`, `data/interior-lite.json` | Furnishes every floor to d1, d2 or d3 from rules learned from the best-liked builds; strips any design to d1; furnishes any existing blueprint against its real walls; checks its own work (`audit`, `lab/check_interiors.js`). See `docs/INTERIOR_DESIGN.md`. |
| Interior library | `lab/mine_kitbash.js`, `data/kitbash-interior.json`, `lib/kitbash.js` | Small groups of furniture and decor (2 to 10 pieces) mined from the vanilla corpus, each in the frame of its anchor: a wall run, an inside corner (90, 135 or 120 degrees), a window, the fire, a table, a bed, a stair's underside or a post. Each records offsets, turns, what each piece rests on, how deep it clips into the others and the wall, how far it sinks below the floor, room kinds and source builds. Also a table of the 220 decor prefabs builders use, with their anchors and clip depths. See "Interior kitbash". |
| Room layout | `lib/layout.js`, `data/room-layouts.json`, `lab/layout_measure.js` | The big picture of each room (D-070): a scheme per room drawn by weight, culture, village and household traits (which end sleeps, which wall works, where the table and storage go), scores added to the decorator's and the library's spots for beds, tables, stations, storage, benches and the high seat, and lanes kept open from each door to the fire, stairs and beds at the end. Research, pictures and rules in `docs/ROOM_LAYOUT.md`. |
| Checks | `lib/checks.js`, `lab/check_set.js` | Every piece connected to the ground, no doubled pieces, doors you can walk through, headroom under roofs and ceilings, ladders and stairs you can climb, no woodpiles indoors, materials the biome has (furnishing too), floor left free. See "Structure rules". |
| Renderer | `lib/render.js`, `lib/sheet.js` | Four views (front left, back right, top, inside with the roof off) and top-down room plans at a true scale, as PNG in Node or on a canvas in a browser. Each piece is drawn from its model in `data/piece-models.json`. See "Renderer". |
| Piece models | `lab/extract_models.py`, `lab/build_models.js`, `data/piece-models.json`, `lab/piece_sizes.js` | Bounds, colliders, pivot and a low-poly proxy (boxes and prisms with colors) for 682 vanilla pieces, measured from the game's prefabs on Tyler's PC. Catalog sizes against the game: `docs/PIECE_SIZES.md`. |
| Request page | `web/app.html`, built to `web/index.html` by `lib/build_web.js` | Type or pick a request, get the best of up to 16 candidates, turn it round, download the `.blueprint`; a second tab strips or furnishes an uploaded blueprint; a third repairs one; a fourth (Interiors) shows one house furnished for several households, one household laid out several ways, or several houses of a kind, as ground floor plans side by side. Published as the artifact "Villheim Blueprint Lab"; a copy is in `BepInEx/config/Villheim-tools/` on Tyler's PC and opens offline. |
| Requests | `lib/request.js` | Request words to choices, the best of several seeds, and one request made from short codes. Shared by the page, the game (`vh gen`) and `lab/process_requests.js`. |
| Game bundle | `lib/build_engine.js` to `src/Villheim.Logic/Generator/lab.js` | The generator for the game, run by Jint. See "In the game". |
| Repair | `lib/repair.js`, tests `lab/test_repair.js` and `lab/test_repair_chunk.js` | Fills in pieces missing from an uploaded blueprint from the rest of the build: gaps in a row, a missing course in a stack, holes in a floor, the mirror of the other half when the build is mostly symmetric, and pieces that the build's own patterns call for. Each added piece carries a reason and a confidence. Third tab of the request page. |
| Millénaire study | `lab/mc_convert.py`, `lab/mc_eval.js`, `lab/mc_render.js`, `lab/mc_compare.py`, `data/mc-blockmap.json` | Translates Millénaire schematics into blueprints for study and measures how well they translate. Kept apart from the lab's data; see `docs/MC_TRANSLATION.md`. |
| Yards | `lab/mine_yards.js`, `data/yards.json`, `lib/yards.js` | What stands outside the walls of the corpus builds (fences, gates, paths, beds, piles, lamps, carts), how far out, how fences turn and how deep pieces sit in the ground; the yard a stage 2 or 3 home or farm gets from it. See "Yards" under the component bench. |
| Pool audit and gate | `lib/audit.js`, `lib/mesh.js`, `lab/audit_pool.js`, `lab/make_testpool.js` | Every defect seen in a game test is a number for a whole pool (see "Pool audit"). `make_testpool.js` and `vh testpool make` refuse a pool that shows one. `lib/mesh.js` gives what shows of a piece (the model's parts in world space) beside what is solid (`lib/shapes.js`). |
| Review set | `lib/gen_set.js` | Every type in five biomes at s1d1, s2d2, s3d3, plus six cultures; best of 8 each. 273 designs, all pass every check (2026-11-09). |

## Measured building conventions

From `lab/offsets.js` over the corpus. The generator and renderer both follow these, so a generated design lines up
the way a hand build does.

- Walls, floors, beams and poles pivot at their centre. Furniture and props stand on their pivot (about 0.1 m above
  the floor piece's pivot).
- A gable roof has a 2 m ridge cap on the ridge and rows centred 2, 4, 6 m out from it. Each row's low
  edge rests on the beam at its outer edge.
- A 26 degree roof piece pivots on its low edge; a 45 degree piece in its middle. Both run 2 m across and rise 1 m or
  2 m toward their local -z.
- Gable pieces (`wood_wall_roof`, `_45`) sit under each row with their pivot on the row's low edge and rise toward
  their local +x. Plain walls fill below them.
- Hip corners (`*_ocorner`) sit at a row's low edge, turned 180 at the front left, 90 at the front right, 0 at the back
  right and 270 at the back left. A 45 degree corner sits 1 m below the side piece next to it; a 26 degree corner level
  with it.
- Roof rows line up with wall bays only when the building's depth is an odd number of bays, so the generator keeps
  depths odd under pitched roofs.

## Structure rules (Tyler's in-game review, 2026-11-09)

Tyler built the first designs in the game (T-04 to T-10 on the review sheet): doors blocked by a beam or a low roof,
walls and roofs at head height, ladders facing a wall with no hole above, the cloth door turned and hanging half way
up, braziers in the walls and unlit, fires off the smoke hole, woodpiles indoors, dark wood in the Meadows, grass
through the floors. The generator now follows these rules, and `lib/checks.js` checks them on every design.

| Rule | Generator | Check |
|---|---|---|
| Rooms are tall enough | Walls of 3 m (sunken huts 2.5 m, under a steep roof); upper floors 3 m apart. | `headroom`: every covered floor point inside walls, away from the wall itself, has 2.4 m clear under every roof, ceiling and level beam, and the walls beside it are at least 2.5 m tall. Open floors (roof terraces, yards, decks) are left out. |
| Doors can be walked through | The door piece fits the wall: `wood_door` for a 2 m opening, `piece_cloth_hanging_door` for a 2 m one too (it hangs about 2 m from its pivot; hung at 3 m it stopped a metre short of the floor, T-102), `wood_gate` for barns (3 m); never `darkwood_gate`. Roof, eave and beam pieces in a doorway, or lower than 2.3 m for a metre in front of it or behind it, are taken out (the eave is cut back over the door). A raised door gets a stair: from the ground at 2 m, set half in the ground at 1 m, stopping at the face of a stone course. | `doors`: nothing in the opening, nothing under 2.3 m for a metre either side, and a floor, stair or the ground to step on at both sides. |
| Ladders can be climbed | Each ladder needs three cells in a row: a clear foot, the hole, and a landing. Cells along a wall come first, away from the door and the chimney. The foot stands at the near edge of the hole; in a 3 m storey the climb ends in the middle of the landing cell, whose near half stays open and whose far half gets two `wood_floor_1x1`. In towers each landing is the next ladder's foot, so they climb round the walls. Furniture is kept off the foot, the hole and the landing. Flat roofs get a ladder to a hatch. | `ladders`: a metre of clear floor in front of the foot, a floor to step onto at the top, and nothing lower than 1.9 m over the climb. |
| Fires sit under the smoke | The fire goes to the middle of the smoke hole: the ridge caps left out over it, the open crown of a ring roof, or a cell of a flat roof. A chimney goes over a ridge or flat-roof hole, through any upper floor: a plank box with a raised cap on short posts (a smoke louver). A stone chimney would stand on the wooden roof or floor and fall, so there are none. Ring roofs keep their open crown. No fire laid: the ridge is closed again. A hearth in a room under 40 m2 becomes a fire pit. | (the fire's place is set by the generator) |
| Ceiling braziers hang lit | `piece_brazierceiling01` hangs on its 2 m chain from the lowest roof or ceiling piece over the middle of its room (two in a hall are spread along it), at least 2.3 m up and away from the fire; where the room is too low it stands as a torch. The spawner lights every fire, brazier and torch a design brings and keeps it lit (`DesignSpawner.KeepLitPatch`). | |
| Woodpiles outside | Woodpiles placed indoors move outside against an outside wall, away from the doors, or are left out. | `woodpiles`: none under a roof inside walls. |
| Materials by biome | Dark wood takes tar (Plains): the Swamp kit is wood and iron; dark roofs, frames and porch roofs start in the Plains. Furnishing the biome cannot make comes out; the generator's own props (well and pen barrels, camp benches) are swapped for ones it can. | `materials`: every piece, structure and furnishing, by `pieces.js` `needs`. |
| Floors in the ground | A 1 m stone floor sits half in the ground. Posts and stilts start a metre in the ground. The game sets a design's lowest pivot on the ground, so both keep fields, wells and pens on the ground too. In the game the ground under every floor on or in the ground is painted dirt and set level: just under a thin floor, 0.15 m under the top of a stone floor. Ground higher than that is dug down, so no hump shows through (the lumpy stone floors of T-102). Each ground point is written directly, the way the slotting board writes it; `vh preview`, `vh gen` and `vh place` write the whole design's floors in one pass (`DesignSpawner.SpawnAll`), village builds floor by floor. | |
| Roofs keep to the walls | Gable and hip rows end on the wall top: no 2 m row past the wall on low roofs (T-102: roofs stuck out). Only cultures with eaves 2 (fen houses, sunken huts) carry a row down past the wall. Ring roofs reach 0.75 m past the wall (a tent's cone still runs to the ground). Awnings only over outside doors. Gable ends and ridge caps end at the gable wall. | |
| Nothing falls | Valheim holds pieces up by material (`pieces.js` `SUPPORT`): stone takes no support from wood and cannot reach sideways; black marble and grausten can span one bay. So: over a door or window in a stone wall, and in that bay all the way up, the wall is planks (a timber lintel); a stone gable course only stands on stone; a parapet block only on a stone wall; stone and marble walls never stand on posts (planks instead); upper storeys of stone-base walls are planks; a 1 m course in 2 m grausten walls is stone; a dome's drum on its wooden ceiling is planks and the stone block on top is gone (the crumbling Byzantine temple, T-102); a round tower's upper floors reach the walls. | `stability`: support from the ground up, piece by piece, by each piece's material (vertical and horizontal loss, the material's max as a cap, under its min it falls). |
| Every house sleeps someone | Round homes and halls are at least 9.7 m across (a 4.8 m hut had no room for a bed beside the fire). When the furnishing leaves a house or longhouse without a bed, the last pass puts the best bed the biome makes against a wall (head to the wall, or along it between a hall's aisle posts), clear of doors, ladders and the fire, moving a table or bench if it must. | `beds`: every home and longhouse has a bed its biome can make. |

Measured pivots (corpus neighbours, `pieces.js` `DOORS` and `CLIMB`): `wood_door` pivots in its middle (2 x 2 m);
`wood_gate` 1 m above its bottom (2 m wide, 3 m tall); `darkwood_gate` on its bottom (4 m tall);
`piece_cloth_hanging_door` hangs about 2 m from its pivot at the top of a 2 m opening, turned 90 degrees against its wall and
0.3 m to one side of it; `wood_stepladder` stands on its pivot and climbs 2 m over 2 m toward its local -z;
`wood_stair` pivots in its middle and climbs the same way; `piece_brazierceiling01` hangs about 2 m below what it
hangs from.

`node lab/check_set.js [tries] [--gen <lib dir>] [--list]` runs every check on the review set and the culture samples
without drawing them; `--gen` makes the designs with another copy of the lib to compare. On 2026-11-09, best of 8:

| | Review set | Culture samples |
|---|---|---|
| Before (old generator, new checks) | 65 of 225 | 18 of 147 |
| After | 225 of 225 | 147 of 147 |

On single seeds (every type, seven biomes, three stages, six seeds; 1,890 designs) 524 passed every check before and
1,890 after. With the new decorator merged, `lab/check_interiors.js` finds nothing but 7 thinly furnished tower floors
in its 702 designs. In the game engine (Jint under .NET 8) a request at best of 8 takes 1.8 s on average and 7 s at
most over the 62 test requests.

Culture ids that have changed or may change sit in `styles.js` `ID`; a renamed id goes in `RENAMED` so old requests
still work (`caucasian-highland` is now `lamari`, D-046).

## What the corpus says (2,134 designs, 2026-11-08)

Rules, shapes and scorer were relearned on 2,134 designs after the valheimians downloads (and their `.vbuild` files,
converted by `lab/vbuild_to_blueprint.py`) were sorted in. The counts below are from the first run on 1,427; the new
totals for the 1,755 builds the shape reader could align are: plans irregular 603, none 212, T 193, rectangle 176,
octagon or round 158, L 136, square 119, U 80, long 57, cross 21; roofs none 392, gable 368, cross-gable 352,
conical 255, flat 244, hip 119, half-hip 15. The scorer is unchanged in
substance because the new downloads carry no Yes or No (AUC 0.70 on the same 661 reviewed designs).

- Plans: irregular 452, T 150, rectangle 130, octagon or round 113, L 94, square 84, U or courtyard 58, long 36,
  cross 17. Tyler's keepers: irregular 68, T 37, rectangle 35, L 21, octagon 15.
- Roofs: cross-gable 274, gable 261, ring 180, flat 178, hip 94. Keepers: gable 73, cross-gable 62, ring 35.
- Walls by biome: Meadows half-timber 144 and plank 110; Black Forest stone 151, stone base 41, log 34; Swamp stone,
  stone base, half-timber and plank; Mistlands black marble; Ashlands grausten.
- Pairings: round plans carry ring roofs, L and T plans carry cross-gables, towers carry hip roofs or none.
- What the keep score rewards: more kinds of piece for the size, fewer pieces overall, more roof and posts, fuller
  rooms, fewer modded pieces, less lighting.
- Thin spots: only 3 builds read as Middle Eastern and 24 as East Asian. Those styles lean on hand-set rules
  (`styles.js`) more than on learned numbers. A slow keyword search of valheimians for desert, Asian, medieval,
  Celtic and other styles found 17 more downloadable builds (8 Japanese among them); they and about 200 late downloads
  wait in Downloads to be sorted and added (see the 2026-11-08 note).

## Request to design

0. Culture: the one asked for, or one of the biome's cultures by weight (`styles.js` BIOME_CULTURE). A culture may
   give a type its own form (`forms`), which sets the plan, roof and walls below; see `docs/CULTURE_STYLES.md`.
1. Plan from the type and stage (weights from the corpus counts per type), unless the request names one. Round plans
   only for styles that build them.
2. Roof from the culture (weights from culture by roof), forced to a ring roof on an octagon and to a hip or gable
   elsewhere.
3. Walls from the biome's corpus counts, or the culture's own.
4. Size from the type table, nudged by the seed; depth kept odd under a pitched roof.
5. Footing: stilts (swamp), short posts (raised floors), a stone course (Black Forest, Mountain), or none.
6. Wings for the plan; floor cells; outside edges; one door on the main wing's front; windows on alternate bays;
   posts at every corner of every bay; top plates.
7. Roof per wing. Where wings cross, the lower roof runs into the higher one; pieces hidden under the higher roof are
   left out. The ridge caps over the fire's place are left open for smoke.
8. Porch, pier, field, pen, dragon heads where the type and culture call for them.
9. Roof and beam pieces in a doorway come out. Furnishing by room use and decor stage, then the last pass (see
   "Structure rules"): the fire under the smoke hole and a chimney over it, braziers hung, woodpiles outside, nothing
   in a doorway, on a ladder or in a chimney, nothing the biome cannot make.
10. The page and the review set build several seeds and keep the one that passes the most checks, then scores highest
    (`lib/request.js` `best`: seeds n, n + 101, n + 202 and so on). `best` builds every seed bare first
    (`skipDecor`) and ranks them on their keep score alone, then furnishes and checks the best in order until one
    passes every check (at most four), since furnishing and the checks are the slow parts in the game. In the game
    engine (Jint, .NET 8, 62 test requests at best of 8) this took a request from 1.9 s on average (7.3 s at most) to
    0.6 s (1.7 s at most), 2026-11-09.

A request may also name storeys (1 to 3) and ask for a porch or none. Both, and an asked roof pitch, go into the
design's name (`-2st`, `-porch`, `-noporch`, `-p45`), so two requests never share a file name. A porch is only built
where the plan has a front for one; otherwise a note says so.

Request words are read by `lib/request.js` (`read`), the same code for the page, the game and the request processor:
plan (L-shaped, T-shaped, cross, courtyard, round, long, square), roof (gable, hip, flat, shed roof, lean-to, steep,
low roof), walls (plank, half-timber, log, stone, stone base), storeys (one, two, three storeys or floors, upstairs,
loft), porch (porch, veranda, no porch), size (small, large) and decor (bare, cosy, rich), plus biome and culture
words. A culture key written among the words (`middle-eastern`) counts as the culture.

## Massing: shapes, sizes and growth (D-069, D-068)

A building belongs to a household, and its later stages grow from its earlier ones. In the game a village upgrades a
building piece by piece, so the s2 design keeps the s1 shell and adds to it, and the s3 keeps the s2. Data in
`lib/styles.js` (`HOUSEHOLDS`, `LADDER`, `GROWTH`, `PLAN_SETS`); code in `lib/generate.js` (`massingPath`,
`wingsFromSpec`, `planLabel`). Measured by `lab/massing.js`.

How a request is read:

- `lineage` names the household (the seed when left out). Every stage of the same type, culture and lineage comes
  from one random stream that never sees the stage asked for, so s1, s2 and s3 agree. To build a house's next stage in
  a village, ask with the same lineage (or seed) as the stage before it. `request.js` `best` holds the lineage at the
  asked seed for every seed it tries, so the tries differ in detail and the household stays the same.
- `fresh: true` asks for a plan drawn anew at each stage, as before this work. A named `plan` does the same.
- Cultures whose form sets its own shape and size per stage keep it (round houses, tents, yurts, the Icelandic gable
  row, courtyards, keeps, churches, sunken huts). Svan houses, raised storehouses and open sheds take the household's
  size and storeys only.
- Types with a growth set: home, longhouse, tavern, smithy, woodworker, workshop, storehouse, barn, crop farm (its
  field lies in front, so it grows back and to the side). Docks, stalls, temples, towers, wells and camps keep their
  stage tables.

The path, drawn once per household:

1. Roof and walls. A hip roof keeps to length and one end wing (a T, U or cross under a hip read as a broken
   roof); a shed roof keeps to one ridge; flat roofs take no annex. The wall style holds for every stage; where D-012 keeps an early
   stage in wood, a stone choice waits for the later stage.
2. Size. Homes by household, in 2 m bays (along the ridge by across):

   | Household | Odds | Main wing | Most wings ever |
   |---|---|---|---|
   | One person | 3 | 3x3 or 4x3 (6 x 6 m, 8 x 6 m) | 1 |
   | Two people | 4 | 4x3 or 5x3 | 2 |
   | A family | 3 | 5x3, 6x3, 4x5 or 5x5 | 3 |

   Other types take a length between their s1 and s2 sizes; four longhouses in ten are as deep as an s2 hall from
   the first. A house with metre-thick stone walls is at least 8 m long, so a bed fits beside the fire.
3. One plan step at s1 and s2, two at s3, each from the odds of the steps the building can take then.
4. Storeys: one more now and then at s2 and s3; a third only at s3 on a house 10 m deep that had two at s2. A
   one-person house takes half the odds, a family half again as much. Cultures that build two storeys at a stage
   (`storeys` in CULTURES) never get fewer. The tower-block rule still applies after (eave within 1.1 times the short
   side).
5. Extras, kept once built, within the stage's budget: porch, lean-to, balcony (two storeys only), dormers (the
   cultures that build them), a tower at a back corner (s3, one-ridge halls of the cultures that build towers).

Steps:

| Step | What it adds |
|---|---|
| rect | one room under one ridge (s1) |
| long | one bay more at each end (only while the house has no end wing or annex) |
| side | a narrow side room at one end, toward the front (s1) |
| back | a room or wing at one end, toward the back |
| annex | a lower byre or store in line at one end (a second ridge line) |
| extend | two bays more at one end under the same roof; the old gable wall comes out |
| L | a wing at one end, toward the front; as deep as the house when it is 6 m deep and long enough |
| T | a wing from the middle of the back |
| cross | the T wing run through to the front, or a new wing through the middle |
| U | wings at both ends toward the front, with a yard of 6 m between them |
| round | a round house (Norse forest, 3 in 100; never Meadows Norse, Tyler 2026-11-09); it stays round |

Wings stand a bay clear of each other outside the main wing. A front wing leaves at least one bay of the main front
for the door, and the door goes a bay away from the inside corner of a wing that comes forward. Wings come forward
4 m or 6 m. The plan's name joins its wing kinds: `L+T`, `T+nave`, `U+T`, `Z` (end wings toward front and back).

The ladder, at most per stage (`LADDER`):

| Stage | Wings | Storeys | Extras | Roof |
|---|---|---|---|---|
| s1 | 1 (a side room or annex only) | 1 | 1 | one main ridge |
| s2 | 2 | 2 (uncommon) | 2 | ridges meeting at valleys |
| s3 | 3 | 3 (rare, deep houses only) | 3 | towers and more |

Each culture's homes have their own plan set (`PLAN_SETS`): Norse build in lines, L, T and cross (Norse forest seldom
round); Anglo-Saxons in long straight halls with annexes; Frankish town houses turn L and T and rise to two storeys
early; Slavs and fen folk add rooms in line; Byzantine houses go L, then U; Middle Eastern houses U. Other types
share a set per type (`GROWTH`): longhouses grow long, taverns branch, barns lengthen.

Footing over the stages: where a culture puts a stone course under its houses only once stone is allowed (Black
Forest and Mountain s3, D-012), the household's house stands on short timber posts at the same height until then, so
the course goes in under the walls later without moving the house. Open-sided sheds stay on the ground. A Slavic
household on a log ground storey (families, and half the halls) has it from s1.

Measured 2026-11-09 (`node lab/massing.js`, 8 seeds of every village culture's types; growth over 6 types, 6 biomes,
4 seeds; the shell is walls, floors, posts, beams, doors and windows matched by role, material, place and turn):

| | main before | after |
|---|---|---|
| s1 shell kept at s2: half or more (home, tavern, smithy; three biomes; 3 seeds) | 5 of 27 | 26 of 27 |
| s2 shell kept at s3, same sample | 6 of 27 | 26 of 27 |
| s1 kept at s2, mean over 144 | 34 % | 79 % |
| s2 kept at s3, mean over 144 | 22 % | 66 % |
| Plans at s1 | rect 52, round 21, square 11, long 8, gables 7, nave 2 | rect 46, round 21, square 10, long 9, gables 7, L 6, nave 2 |
| Plans at s2 | rect 33, round 21, L 12, long 11, gables 7, T 6, nave 5 | long 22, round 21, rect 20, L 14, gables 7, nave 3, T 2 |
| Plans at s3 | round 21, L 15, T 14, rect 12, long 9, cross 9, gables 7 | round 21, L 15, long 11, L+T 8, rect 8, cross 7, gables 7 |
| Median ground footprint, homes with wings (s1, s2, s3) | 36, 68, 144 m2 | 56, 72, 96 m2 |
| Median ground footprint, longhouses | 108, 204, 280 m2 | 120, 144, 204 m2 |
| Two storeys or more, all types (s2, s3) | 9 %, 27 % | 6 %, 14 % |

The s3 footprints are smaller than before: an s3 house is now its s1 house with wings added, where before it was
drawn at the s3 table size (10 to 12 m by 10 m) from scratch. All checks pass on single seeds as well as at best of 8.

### Handoff (2026-11-09)

Done (branch `feat/massing`, main merged):
- Stage 1, the ladder and plan sets as data (`styles.js`), and stage 2, growth lineage (`generate.js` `massingPath`),
  as above. `request.js` `best` holds the lineage over its tries. Persona's household size follows the house (one
  person, two, a family) and is seeded by the lineage. No household changes roof over its stages (0 of 5,760).
- Test pool lines (Norse Meadows, tries 1) keep one shape per line; home 303 no longer turns round. Lead's measure on
  these seeds: s1 to s2 keeps 70 to 96 % of the shell, s2 to s3 50 to 99 %; hall 11 and storehouse 41 drop to 50 %
  at s3.

Half done:
- Hall 11 and storehouse 41: the s3 cross and T wings run through or behind the hall, and the storehouse's raised
  floor and posts move with the new wing; look at `wingsFromSpec` and the footing code in `generate()`.
- Two new interior findings in new hall shapes (decorator placements): a bench floating 0.4 m up in a fen-folk nave
  longhouse (Swamp s2d2 seed 282), a table against a ground torch in a Byzantine T+nave longhouse (Mistlands s3d3
  seed 116).
- Footprints at s3 are smaller than before (homes 96 against 144 m2); more growth would come from a second storey on
  more houses or longer wings.

Next (stage 3 of the brief): wings at different heights, cross gables, more windows on some houses, towers on late
halls of the cultures that build them, picture sheets per culture across seeds and stages.

Checks on the merged branch: check_set 225, 90 and 147 pass; test_structure 36 hold; check_interiors bareFloors 7,
beds 0, stairs 1 (main 4), floating 1, overlap 1; gen-test 5 of 5 the same byte for byte. Single seeds: 432 of 432
(main 432), and 1,146 of 1,152 over every village culture (main 1,149; six furniture clips in half walls).

## Renderer

`lib/render.js` draws every piece from its model in `data/piece-models.json` and falls back to the box shapes of
`lib/pieces.js` for pieces without one (mod pieces, placed food and items). A small z-buffer rasterizer fills the faces
two by two samples per pixel, so faces never sort wrong; each face is lit by a sun and an ambient term, gets a dark
line where it meets another part, piece or the background, and gets a simple pattern for what it is made of: boards on
plank walls and floors, courses and mortar on stone, cross-hatching on thatch, zigzag shingles on dark wood roofs,
log seams, lattices on shutters, braces on doors, rails on fences, borders on rugs, bands on chests and banners, veins
on black marble, rivets on Dvergr and iron. A pattern is left out when its smallest feature would be under about 4 px,
so small pictures stay clean. The same code runs in Node (@napi-rs/canvas) and on the request page.

The models. `lab/extract_models.py` runs on Tyler's PC only (UnityPy over the game's asset bundles). For each
prefab it walks the GameObject tree with its transforms, keeps the active LOD0 meshes, measures the render bounds,
reads every collider (box, sphere, capsule; a mesh collider as one or a few boxes) with its layer, and marks it solid
when it is not a trigger and its layer collides with the player in the game's collision matrix (`globalgamemanagers`;
`python3 extract_models.py layers` writes it to `<work>/layers.json`). It also keeps the snap points (inactive children
tagged `snappoint`). Then it fits a proxy: flat parts of one material and color that touch and still form one layer
(gable boards, thatch, shingle rows, blankets, rugs) are joined first; each part then becomes the one box, prism (a
triangle, wedge, trapezoid or n-gon outline pushed out along one axis) or few boxes that best cover its voxels, with
flat parts fitted by their outline seen square on. Up to 150 parts a piece (40 for small ones), nails and other small
bits left out. Each part's color is the game texture sampled at the part's own UVs, with a material class from the
material's name. `lab/build_models.js` turns the raw file into `data/piece-models.json` (1.9 MB, 685 pieces, 12,501
parts, with `solids`, `pass` and `snap` per piece) and `data/piece-solids.json` (115 KB, the solids only, read by
`lib/shapes.js` and bundled for the game and the request page). The meshes and textures stay on Tyler's PC; the repo
holds measurements, collider boxes and our own boxes and prisms.

API (old calls work as before):

- `draw(ctx, pieces, opts)`: `az`, `el` (90 is straight down), `cut` (structural pieces are cut at that height and
  the cut shows dark; furniture is drawn whole or, when it hangs above the cut, left out; roofs are left out), `hide`,
  `width`, `height`, `background`, `label`, `ss` (samples per pixel each way, default 2), `crop` ({x0, x1, z0, z1},
  world metres, to frame one room), `ppm` (pixels per metre), `grid` (1 m grid, top views), `scale` (scale bar),
  `outline`, `patterns`, `models` (false for the old shapes). Returns `{ppm, ms, faces}`.
- `plan(ctx, pieces, {cut, crop, ppm, margin})`: straight down at a true scale with grid and scale bar;
  `planSize(pieces, {crop, ppm, margin})` gives the canvas size for it.
- `sheet.plan(pieces, out.png, opts)` writes one; `node lib/cli.js plan in.blueprint out.png 50 1.8 x0 x1 z0 z1` does
  the same from the command line.
- `coverage(pieces)` counts which pieces have a model and which fall back.

One room from above at 50 px per metre, cut 1.8 m over its floor:

```
const R = require('./lib/render.js'), { createCanvas } = require('@napi-rs/canvas');
const crop = { x0: -4, x1: 4, z0: -3, z1: 3 };
const { width, height } = R.planSize(pieces, { crop, ppm: 50, margin: 0.3 });
const c = createCanvas(width, height);
R.plan(c.getContext('2d'), pieces, { crop, ppm: 50, margin: 0.3, cut: floorY + 1.8 });
```

On Tyler's PC only: `extract_models.py` with `VH_MESHES=1` also keeps a decimated copy of each piece's real meshes
(vertices merged on a 3 cm grid, a color per triangle) and `meshpack` joins them into
`BepInEx/config/Villheim-tools/villheim-meshes.js` (685 pieces, 14 MB). The page built with
`node lib/build_web.js <out.html> --meshes villheim-meshes.js` loads it when it sits beside the page
(`Villheim-tools/Villheim-Blueprint-Lab-renderer-preview.html`) and draws those pieces from the real meshes; in Node,
`VH_MESHPACK=<path>` does the same. The pack is never committed or published. On a Meadows home the meshes and the
proxies cover the same pixels to within 0.2 % in all four views.

Times in Node (2026-11-09): 1600 x 1000 views of 150 to 550 piece designs take 0.5 to 0.8 s each; a 8 x 6 m room plan
at 50 px per metre 0.1 to 0.3 s. On the request page the main view takes about 0.65 s at two samples and 0.3 s at one
(headless Chrome); it draws at one while dragging. Old and new pictures: `docs/renderer/`.

## Component bench and critic

`node lab/bench.js <part> [out dir] [variants per building]` holds a building fixed and varies one part through its
flags (`req.details` overrides the detail profile, `req.style` the culture), checks every variant and draws a close-up
of the part on a contact sheet (`<part>.png`, `<part>.json`). It picks test buildings where the part shows (each flag,
turned off alone from the full set, changes pieces near the part), frames the camera once per building on the pieces
the part adds, seen from outside, and cuts the roof away for inside parts. Parts: `door`, `window`, `gable`, `wall`,
`stack`, `dormer`, `bed`, `stair`, `yard`, and `interior` (one close-up per assembly the interior library placed, seen
from inside the room with everything over 2.6 m cut away:
`node lab/bench.js interior [out dir] [designs] ["type,biome,stage,decor,seed;..."]`). Sheets go to a reviewer that has
not seen the code; its findings become fixes and
odds, and the part goes back on the bench.

`lib/critic.js` measures a design the way `lab/learn_critic.js` measured the top quarter of corpus house builds by
downloads (ridge lines, skyline rise and fall, piece kinds, materials, height, trim per wall area, with a limit on busy
trim). `lib/request.js` ranks the seeds of a request by 0.4 keep scorer plus 0.6 critic.

Parts added on 2026-11-09:

| Part | Where | When |
|---|---|---|
| Bar counter | Half walls with beams on top 1.5 m out from a long wall of a tavern's main room, barrels behind, mugs on it (`lib/kitbash.js`); tables, seats and chests in its way give way to it. | taverns, d2 on, main room 8 m or longer |
| Canopy bed | A 2 m post at each corner of a bed's footprint and a rug laid over them. | homes and longhouses, d3, 50 %, where the ceiling is 2.5 m up and nothing stands at the corners |
| Chimney stack | Stone blocks against the outside of a gable wall from the ground to 0.8 m past the ridge's top, two deep for the first 2 m on half of them, a 2 x 2 slab and a 1 m pot on top; clear of windows, other wings, decks and the woodshed. | stone-capable biomes and stages, homes, longhouses, taverns, smithies, temples, gable roofs, 35 % |
| Wall dormers | A 4 m gable on the wall top with its own two roof pieces and ridge cap running back into the 45 degree main roof; one over the middle of the front or a pair. A dormer over the door takes the place of a gable porch. | Frankish, English, medieval, Slavic, highland and Baltic cultures, s2 on, homes, taverns, longhouses, stores, workshops, 45 % |
| Stairs | A straight flight of `wood_stair` along a wall (each climbs 1 m over 2 m), a clear cell at its foot, a landing at the top, the floor above open over the flight. Replaces the first ladder. | two-storey homes, taverns, longhouses, stores, workshops, s2 on, storey heights in whole metres, 75 % |
| Hearthstone | The plank floor under a ground-floor fire laid in stone floor pieces, flush with the planks. | stone-capable, floors on the ground, no stone walls |
| Lean-to (outshut) | A 2 m deep lean-to along the back wall of the main wing (at least three bays, not the end bays): 26 degree roof pieces from the wall, posts from the ground, a beam, firewood, barrels or a bench under it. | homes, longhouses, barns, smithies, workshops, stores, farms, taverns, s2 on, 40 %, timber walls, floors up to 1 m |
| Loggia | The front row of the ground floor left open under the upper storey on posts; the front wall and door set back a row; no porch, gallery or door hood. | two-storey rect and long timber homes, taverns, stores, workshops of the Anglo-Saxon, Frankish, medieval, Slavic and Norse cultures, s3, 60 %, on the ground, 10 m deep or more |
| Barn stalls | Half-wall partitions every 2 m along a long wall, a gate across each stall, straw inside. | barns, d2 on |
| Loft window | One clear 2 m light framed by beams, a third of the way up a gable 6 m tall or more (1 m up a lower one). | with gableWindow |
| Ridge chimney | The shaft through an upper floor ends inside the roof; above the ridge, raised caps on short posts. | ridge vents |
| Dais | The throne the furnishing set against a hall's wall goes up 0.3 m onto a 4 m by 3 m platform (1 m floor pieces on short beams), with its rug, lamps, table and what stands on them; round posts, never over a stair, door or the fire. | longhouses and temples, d2 on, where a throne stands |
| Gable-end windows | One window per floor, in the middle bay of a gable end. | gable roofs |
| Stone walls | Windows in every fourth bay instead of every second (each opening needs a timber bay). | stone wall styles |
| No tower blocks | The eave stays within 1.1 times the plan's short side; storeys come off until it does. | all but towers and fixed forms |
| Tidy furnishing | A rug with nothing standing on it and a chair with no table within 0.9 m (or fire within 1.6 m) come out; a long table with no seat gets a bench along each long side where there is room. | all furnished designs |
| Vignettes | On a ground room's plain wall bays with nothing 1.6 m in front: a bench under a wall torch, a chest beside a barrel, or an armor stand, by what the biome makes; one bay in three at most, not near doors. | d3, all but barns, stores, docks and farms |
| Kitchen | A butcher's table against the wall nearest the cauldron, the spice rack and pots and pans hung on the walls nearest it, all within 4.5 m. Gated by their materials: turnips (Swamp), silver (Mountain), black metal (Plains). | wherever a cauldron is |
| Yard fence | A fence 2 to 4 m out from the walls (D-060 B), as 'front' (round the front from the side walls), 'L' (front and one side, meeting the back wall), 'wrap' (all round) or 'side' (along one end wall); a shape that runs into something already there (a field, a woodshed, a stair, a door's 2 m) gives way to the next, and the plot's radius as the game reads it (Blueprints.cs: farthest pivot from the middle of the pivots' box, plus 2 m) grows by 4 m at most. Wood fence, dry stone fence (where the stage allows stone, D-012) or posts and rails, by culture. Winding: outer corners cut with 2 m chords at 45 degrees, or at 22.5 and 67.5 degrees, the turns corpus fences make. Fence ends meet the wall; the last panel of a run laps the one before it (marked `clip`). | stage 2 and 3 homes and farms (`req.yard` true or false overrides), not on stilts or boardwalks |
| Yard gate and path | A `wood_fence_gate` (2 m opening, the corpus's 2 m gap) on the run nearest the door, with 1.2 m clear either side; 2 m posts beside it at s3. A path of 1 m planks from the door out to a lane 1.5 m in front of it, along to the gate's line and through the gate, round anything already there. | with a yard fence |
| Yard contents | Raised beds of beams on the ground (2 m by 1 m, as the corpus's 2.2 by 1) with a row of the biome's crop (carrot, turnip, onion, barley; dandelions, mushrooms and thistles in the Meadows); firewood against the fence (a woodpile the furnishing left against an outside wall moves here); a bench against the front wall beside the door; a lamp inside the gate; bushes along the fence, dandelions along the walls; a cart (Black Forest on) and a scarecrow (armor stand, Swamp on) on farms. By culture: a pile of field stone (Celtic, Norse highland, Saami), a stack of core wood logs (Norse forest, Slavic, Baltic), a second bed (Frankish, Anglo-Saxon, Byzantine), a cart (steppe). Where the house stands on 1 m stone floors, the ground in front of the door is laid in the same stone, level with the floor inside (two or three cells, six at s3). On a yard below y = 0 (the turf houses' sunk floors) only the fence, path and plants. Plants are part of the build; the rest is furnishing. Nothing taller than 1 m within 1.2 m of the walls (the eaves and their braces), nothing in kept-clear places. | beds, firewood, bench d2 on; lamp, bushes, flowers, scarecrow d3; bench switches `yardOrganic`, `yardBeds`, `yardProps`, `yardLamp`, `yardPath`, `yardPave` |
| Door lights | A wall torch on each side of a ground-floor door (1.15 m from its middle, 1.45 m for a gate), 1.55 m up on the outside face; where the biome has no wall torch (Meadows), a standing torch beside the door on the ground. A side that would touch trim, a window or a post stays bare. | front doors d2 on, back doors d3 |
| Gate as front door | The front door is a `wood_gate` (2 m wide, 3 m tall) on a 3 m storey. | longhouses, stores, workshops, smithies, sawmills, farms, s2 on, 60 % |
| Balcony | The upper storey's middle bay of a free gable end becomes a door onto a 2 m square floor with a rail of two beams on corner posts; 26 degree brackets from the wall under a 3 m storey, posts from the ground under a 2 m one. Not on long walls (the overhang's eaves come down to about a metre over it there), not where a stair, stack, woodshed or porch is. | homes, taverns, longhouses, workshops with two storeys or more, gable roofs, s2 on, 50 % (`details.balcony`) |
| Roof valleys | Where two wings' roof pieces of the same kind fill one cell at one height with their slopes at right angles, one inner corner piece takes their place (wood and darkwood, 26 and 45 degrees; eave rows left as they were). | gable roofs where wings meet (`details.valleys: false` turns it off) |

### Yards

Working yards (D-067) and household yards (D-068), 2026-11-09: smithies, taverns, workshops and woodworkers get a yard at
stage 2 and 3 as homes and farms do (docks stand over water and get none). What is in it follows the work: the forge's
cooler and tool rack against the fence, an anvil and the grinding wheel, coal (smithy); tables with a bench each side
and barrels (tavern); core-wood logs, the chopping block with a crate of offcuts, the tanning rack (workshop and
woodworker). Base crafting stations never stand outside without a roof; their extensions may, as decor. A home's yard
follows its household (`persona.yard`): a tended garden takes a garden bed more when the household grows things; a
work yard has no beds and holds logs, the chopping block, a stone pile and, for a household that makes things, the
tanning rack; a plain yard has neither. A building open on a side (a smithy's open front) counts that side as its way
in and keeps it clear. A gate is not set where another run of the fence would cross its way through, and no path
plank goes under a roof, eave or floor less than 2.6 m up.

`node lab/mine_yards.js [compact.json] [out]` reads the corpus (`/home/claude/study/compact.json`, vanilla-only builds,
modded pieces filtered as `lab/learn_critic.js` does), turns each build to its main axis and takes what stands on the
ground outside its roofed area, within 15 m. Measures go to `data/yards.json` for the well-liked builds (top quarter by
downloads, 115 that read as a building) and for all 733 vanilla builds, with up to 40 assemblies of each kind (gates
with what stands by them, fence runs and corners, paths, beds with their borders, piles, carts, seats, lamps,
signposts), each with its source build, downloads and earliest biome. What it found (all vanilla builds):

| Measure | Value |
|---|---|
| Fence segments | 2 m (median); lines 7 m long (median), 22 m at the 90th percentile; one in thirteen lines closes on itself |
| Turns at a joint, lines of four or more | straight 3,017; 22.5 to 25 degrees 673; 45 degrees 312; square 556; others rare |
| Openings in a line | 2 m (median), 1 to 3 m |
| Gates | rare (77 in 733 builds); usually no posts of their own (a quarter have two) |
| Yard depth from the walls | 5.7 m (median of each build's 90th percentile), 4.6 m on the door side |
| Garden beds (three or more plants within 1.5 m) | 2.2 by 1.0 m (median) |
| Path pieces | stone 2 x 2 floors most, then wood floors; 2 m wide |
| Set into the ground | fences up to 0.2 m (75th percentile), props 0.16 m, floors flush |
| Props clipping into a fence, wall or prop | 0.36 m (median), 0.6 m (75th percentile) |

The checks allow a clip marked on a piece (`p.clip`, metres) up to its mark and never past the 0.36 m median
(`checks.js` `CLIP_MAX`).

How the game reads a yard's size: `Blueprints.cs` `Center` moves a blueprint so the middle of the box round its piece
pivots is at the origin and sets its radius to the farthest pivot plus 2 m. Every yard piece counts, so the plot the
village gives already takes in the yard; an off-centre yard (a side yard) moves the house off the plot's middle.
`PlotFinder` keeps plots a radius apart, samples the slope at 70 % of the radius and looks for clutter within 80 %;
`Growth` builds a blueprint set's next level where its radius fits. `lib/yards.js` keeps the radius growth to 4 m
(homes: 9.7 to 11.8 m at s2, 11.6 to 13.4 m at s3 on average). No change to the mod was needed.

Pictures: `docs/yards/yard-bench.png` (the bench sheet: four buildings, the switches on and off) and
`docs/yards/yard-examples.png` (four yards, three-quarter and top views).

## Interior kitbash (D-065, D-066)

Rooms furnished the way the best builders do it: any prefab that ships with the game may dress a room (stations and
their upgrades, stands, food and feasts, pots, Dvergr and trader props, banners, pelts), pieces may be stacked and may
clip into each other, into walls and into the floor, and furniture the game lacks is built from building pieces.

The library. `node --max-old-space-size=10000 lab/mine_kitbash.js [compact.json] [out.json]` reads the 1,561 vanilla
builds of the corpus (242 well-liked: the top quarter by downloads). Every decor piece inside a building is given an
anchor: a table, a bed, the fire, a stair's underside, an inside corner, a window, a wall run or a free post. The pieces
of one anchor are an assembly of 2 to 10, put in the anchor's frame with what each rests on (the floor, the anchor,
another piece, the wall, or hung from structure), how deep it clips into the others and the wall (the penetration depth
of the game's solids, `shapes.js` `clipDepth`) and how far it sinks below the floor. Assemblies with the same anchor
and the same slots (a wood chest and an iron chest fill one slot) within 0.35 m are one. Kept: those in two builds or
more, and groups of three kinds or more seen once in a well-liked build. 12,762 found; 459 kept.

| Anchor | Found | Kept |
|---|---|---|
| Wall run | 4,750 | 100 |
| Corner, 90 degrees | 3,818 | 100 |
| Corner, 135 degrees (octagon) | 439 | 8 |
| Corner, 120 degrees (hexagon) | 84 | 3 |
| Corner, other angles | 228 | 0 |
| Table | 1,091 | 74 |
| Hearth | 584 | 67 |
| Bed | 660 | 63 |
| Window | 542 | 22 |
| Post | 377 | 15 |
| Stair underside | 189 | 7 |

The file also holds the 220 decor prefabs builders use in two builds or more, with their anchors, rests and clip and
sink depths (median and 90th percentile). Item stands lead (291 and 287 builds), then wood chests, chairs, signs, wall
torches, deer rugs, iron chests, fur rugs, armor stands. Builders clip often and shallow: a median of 4 to 19 cm, a
90th percentile of 10 to 40 cm (forges and black metal chests 0.52 and 0.57 m); a tenth of the banners reach 0.55 m
into the floor.

Creative sets (2026-11-10, D-098): 92 sets `KC-001` on (`creative: true`) of combined, stacked and clipped objects,
written by `lab/creative_sets.js` from the decor table, the pairs in `data/interior.json` and the builds on Tyler's
board (`lab/mine_creative.js`, which mines such objects by contact and is ready for the full corpus). Each keeps its
pieces' own prefabs and carries its family, role, household traits (`lib/persona.js` `kitWeight`), rooms, decor
stages, biome (`from`: the earliest that makes its core pieces), footprint, height, source builds and the counts it
rests on. The library holds 193 distinct prefabs (was 109). What they are, where they came from and what was left
out: `docs/INTERIOR_DESIGN.md`, "Creative sets". Pieces set on a chest or barrel stand on its lid (`lib/shapes.js`
`lidAt`), and the fitter refuses furniture more than 12 cm into other furniture as the pool audit measures it.

Built-up furniture (`lib/kitbash.js` `BUILT_KITS`), hand-made in the library's format (second round after the
2026-11-09 review of the inside cuts):
- Against walls: a cabinet (a chest set into a half wall so its front shows as drawers, a plank top of two ledges, a
  candle, mead and a jug); a chest of drawers (two chests stacked, a plank top); shelves (two ledges with candles, meads
  and jam over two barrels); a kitchen wall (a half-wall counter with a plank top, the spice rack over it, sausages and
  carrots, barrels with the pots and pans hung over them); a couch (a log bench against a half wall for its back, a
  post at each end for arms, a pelt in front, a torch); a living room (the couch, a rug, a low table of two short beams
  and a ledge with mead and a candle, a stool each side).
- By windows: drapes (a banner each side, hung 2.35 m up so the hem reaches the floor, from a rod of two beams over
  the window, a bench under it).
- By beds: a bedside barrel with a candle and a mead; a nightstand (a barrel with a plank top and a candle); a
  sleeping alcove (a half wall along the bed's open side with a 2 m post at each end, a bedside barrel with a candle
  on the other).
- On tables: a feast table (the village biome's own feast, candles, meads, a bench each side); a kitchen island
  (sausages, carrots, a jug, a barrel at each end).
- On the free floor (points a metre apart with the room's floor 2.2 m all round, turned along the longest wall and
  across, 0.7 m kept clear round the set): dining sets (a table with a bench each side on a fur rug; a round table
  with four chairs on a deer rug; a long oak table with four benches on two carpets; a Dvergr table with stools), a
  smith's work zone (anvil, grinding wheel, quench barrel, a chest of stock) and a joiner's (a workbench with the
  chopping block, a chest and a barrel), each in its own kind of room. Each set's footprint stays 0.6 m inside the
  walls and 1.8 m from where a stair or ladder lands. One set to a room; a tavern's, hall's or temple's room takes
  one per 16 m2 (six at most), a smithy's or workshop's one per 24 m2 (three at most). Sets may move the decorator's
  tables, seats, chests and lights out of their way and out of the 0.7 m round them, so a hall's tables become a grid
  of sets where they fit and stay where they don't.
- On stations: the smithy's forge gets an anvil, the grinding wheel and a quench barrel; the workshop's workbench the
  chopping block, a barrel and a chest.
- In corners: the tavern's serving corner (stacked barrels behind a half-wall counter with meads); a bath corner.
- Under stairs: one choice per building by the household (see "Households"): a wood chest, two barrels, two crates
  pushed in askew, a chest with a barrel and a pot, or nothing. Below the audit's stair box, under the highest flight;
  tried first in every room with a stair. The generator's keep-clear rectangle over the flight does not apply under
  it; the climb's own zone does.
- Walls between the furniture, three passes, spaced and filled by the household (see "Households"): things hung
  between 1.3 and 2.4 m where nothing hangs within 0.9 m either side (a ledge with a candle and a mead or with jam and a
  jug, a banner, one or two trophies, a shield and a weapon, three tools, a ledge of candles); at d3 in some households
  a second ledge near 2.2 m with a jug and jam; and a wall torch where no light is near (Black Forest on).

A kit's core pieces (the table of a dining set, the forge's anvil, the half wall of a counter) are marked `key`: a kit
whose core piece cannot go is left out, so no rug or bench is left without its table. Each building type comes first
with its own: the home's bedside, the smithy's forge, the workshop's bench, the tavern's serving corner and kitchen
wall. In homes and their rooms the decorator's second and later tables in one room go, with their seats, so each room
has one dining place (`spreadTables`). A rug the furnishing laid with nothing standing on it (four of a table's, bed's
or bench's five footprint points on the rug) goes under the nearest of them within 2.5 m, long side along theirs, or
out when that one has a rug already or there is none (`seatRugs`). Beds the furnishing packed within 0.35 m of each
other or within 1.2 m of a stair go with the chest at their foot, a house keeping one (`spaceBeds`). In a row of four
chests or barrels or more along a wall every third goes, so they stand in twos (`groupStorage`). Woodpiles and stone
piles stay out of the interiors: the checks forbid woodpiles indoors and the audit any pile. Pots, bread and cooked meat are left out: their proxies draw as grey-green
boxes and planks.

Placing. After the furnishing, `furnishRooms` reads every room as the decorator does (`readLevel`), with its anchors:
wall runs every half metre, windows, inside corners where two wall faces meet at any angle, fires, tables, beds, free
posts and stairs. Assemblies are drawn by room kind and decor stage from a random stream of their own (seeded from the
detail stream after everything else, so the rest of a design is unchanged): at most one per room at d1 (rooms of 30 m2
or more), up to three at d2 and eight at d3 plus the dining sets, weighted by score, by how many kinds of piece they hold, and down for
repeats and for pairs of chests; each built kit at most once in a building (shelves, cabinets, drapes, bedsides twice).
Each slot takes the source's prefab when the village's biome makes it, or the first of its class that it does; minor
decor goes in any biome; seasonal pieces and woodpiles are left out. Item stands go in and get an item (below). Every piece is tested: on this room's
floor or against its wall, under its ceiling, out of doorways, climbs, the chimney and the fire's ring, under the sill
of any window behind it, plain wall behind anything hung, what it rests on there (the audit's own tests), no deeper in
the floor than its source, and clipping into walls, the anchor and its own assembly no deeper than its source builds did
(into anything else, not at all). Floor pieces keep 0.9 m of floor in front of them and at most 50 % of a room's floor
is furnished. Built kits may move the decorator's chests, seats and lights out of their way (two at most). A piece that
fails is left out when nothing rests on it, as long as three fifths of the assembly stay.

Clips on purpose. A piece placed with a clip carries `p.clip`, the deepest it reaches into anything. `lib/checks.js`
(the overlap check) and the decorator's audit allow a pair to clip as deep as the larger mark of the two, and no deeper;
a piece set into the floor carries `p.sink`. Kitbash pieces also carry `kb` (assembly and anchor) and `rest`, and the
audit checks what each rests on. These marks are not written to the `.blueprint` file.

Clips made on purpose in the file (D-098, 2026-11-10). A set's own piece (its source's prefab, never a substitute) may
go into what shows of the walls as deep as the library recorded for it (`a.clips`, slot 'w'): `decorate.js` `auditOne`
takes that allowance for `hungInto` and `showsInto` and marks a piece that uses it with `p.wclip`. Two of a set's own
pieces whose furniture boxes overlap as their source builds stood them (a chair under its table) pass the furniture
test and the later one carries `p.fclip`. `lib/blueprint.js` writes both in a `#VillheimClips` section before
`#Pieces` (`prefab;x;y;z;wall depth;furniture depth`) and reads them back onto the pieces; `lib/audit.js` lets
`mountClip`, `intoWall` and `furnClip` pass up to a piece's mark. PlanBuild skips sections it does not know (as it does
`#VillheimPaths`), and the mod's reader (`Designs/Blueprints.cs`) reads only `#Pieces` and `#VillheimPaths`, so the
game needs no change. The info field is no place for the mark: the mod reads a sign's info as its heading
(`DesignSpawner.cs`) and a stand's as its item (`StandItems.cs`). A board save rewritten by `BlueprintEdits.cs` drops
the section (its pieces then fail the pool audit if audited again). Over 72 s2d3 and s3d3 designs three pieces carry a
mark: the recorded wall clips of the mined sets are mostly chests set into walls, and few of those sets get placed.

Materials (D-065, D-126, 2026-11-10): every decor and furniture piece goes in any biome (Rules, "Decor in any biome");
building pieces keep to the village's biome, the earlier ones and the next. `pieces.js` `minor` lists the small pieces
(rugs, banners, food, pots, candles) for other uses only.

Cost: in Node the 154-design comparison (every type, seven biomes, s2d2 and s3d3) took 74 ms a design without the
library and 113 ms with it (2026-11-09, third round; after filing pieces by their own reach, reading the rooms once
and passing over free-floor spots with fixed furniture on them).

### Items on stands (for the mod)

Done 2026-11-09 (lead): `lib/blueprint.js` writes `p.item` of an `itemstand` or `itemstandh` to the info field as
`Name:variant:quality`; `src/Villheim.Logic/Designs/StandItems.cs` puts the item on the stand when the design's piece
goes up and locks it (no taking, swapping or hammer removal; the lock is kept in the ZDO). An item the stand cannot
hold leaves it empty. Armor stands are not done. The design notes below are the plan this follows.

Item stands and armor stands stand empty in a design, so the library leaves them out for now. PlanBuild already saves
what a stand holds in the piece line's tenth field (the one `lib/blueprint.js` reads as `info` and
`Blueprints.cs` as `Piece.Text`): the corpus has `itemstandh;...;"Tankard:0:1"` (item prefab, variant, quality, and on
newer saves a fourth number) on 2,518 horizontal stands and trophies such as `"TrophySurtling:0:1:0"` on wall stands;
an armor stand saves `pose:slot:item:variant:...` per slot (`"0:7::0::0::0::0::0::0::0:"`). The design:

1. The lab: a piece may carry `item` ({ name, variant, quality }); `blueprint.js` writes it to `info` as
   `name:variant:quality` for `itemstand` and `itemstandh`, and reads it back. Choices by room and biome: trophies of
   the village's own biome on wall stands in halls and homes, tankards and meads on horizontal stands on tables and bar
   counters, shields and tools on walls in smithies.
2. The mod: when `DesignSpawner` or a village build places a piece whose prefab has an `ItemStand` and whose `Text`
   splits into a known item prefab and two numbers, it sets `ZDOVars.s_item`, `s_variant` and `s_quality` on the new
   piece and calls `UpdateVisual`, the way `Trophies.Hang` does, and locks the stand as `WantPile.Lock` does, so the item
   cannot be taken. Armor stands the same way per slot, once the format is checked in the game.
3. Cost: the item counts as minor decor (D-066); the stand itself is built from the chest as any piece.

Placed food (meads, bread, cooked meat; the feasts) spawns as items lying where they are put, which a player can pick
up. Until the mod locks them as above, the kits use only a few, on tables, counters and shelves.

What each stand holds (`lib/persona.js` `dressStands`, last thing before a design is written): every `itemstand` and
`itemstandh` gets an item or comes out. A kit may ask for a kind (`want`: trophy, shield, weapon, tool); otherwise the
room and the household decide. Wall stands: in a home, trophies for a household that collects, shields and weapons for
one that collects and shows wealth, tools for one that makes things, a hoe or cultivator for one that grows things; in
a smithy tools, weapons and shields; in a workshop or store tools; in a tavern trophies and shields. Horizontal stands:
drinks and food, herbs where the household grows things, valuables (amber, ruby) where it is well off; a tavern's are
mostly tankards and meads. Items come from the village's biome or an earlier one (the own biome counts double), a
design shows the same item twice less often, and a well-off collector may keep one boss trophy. Each stand draws from
a stream seeded by its place, so it holds the same item at every decor stage. Names are vanilla item prefabs checked
against the corpus's stands (`ITEMS`).

## Households (D-068)

`lib/persona.js` draws a household for every design from a stream of its own (seeded by the seed, type, biome and
culture), so the rest of the design keeps its own streams. Households are broad preferences, never a trade: the
villager who lives in a house is chosen in the game and can change (Tyler, 2026-11-09). A request may name one
(`req.persona`: a preset such as `neat`, `messy`, `busy`, `cosy`, `austere`, `plain`, `wealthy`, `modest`, `alone`,
`family`, `crafts`, `collector`, `plants`, `maps`, `food`, `drapes`, `sill`, `rugs`, `banners`, `garden`, or several
joined by commas, or an object of traits); the name then ends in the preset (`-neat-plants`).

| Trait | Range | What it changes |
|---|---|---|
| `tidy` | 0 to 1 | Wall spacing (neat: wider gaps, more bare spots), how full the decorator fills a room (with `busy`: 82 to 118 % of the corpus rate), the library's budget, what goes under the stairs (nothing or a chest when tidy, stacked things when not). |
| `busy` | 0 to 1 | How actively the space is used: storage rows, crates, under-stair crates, a work yard. |
| `comfort` | 0 to 1 | Rugs, the couch and living-room kits, reading nooks, candles, the bath corner. |
| `wealth` | 0 to 1 | Banners, cabinets, canopy beds (15 to 85 %), torches closer together, armor stands, valuables on stands, one boss trophy for a collector. |
| `size` | 1 to 6 | Seats and dining sets, benches, bench vignettes (`household`: alone, couple, family). |
| `hobby` | crafts, collect, plants, games, maps, food; 0 to 1 each | One or two stand out. Crafts: tools on the walls and stands. Collect: trophies, shields and weapons on show, item stands in the library's kits, armor stands. Plants: pots, herbs, sill decor, a garden yard. Games: seating and tables. Maps: the cartography table, reading nooks. Food: fermenters, kitchen and feast kits, food on tables and shelves, barrels under the stairs. |
| `likes` | drapes, sill, rugs, banners, shelves, lights, hung; 0.25 to 2.2 | Taste: drapes or things on the sill (one or the other), rugs and pelts, banners and color, shelves, light, things hung up on show. One household in six is plain: all its likes run low. |
| `yard` | garden, work, plain | Outside: a tended garden and paths, a yard of materials and work leftovers, or plain. |

Culture odds (`CULTURE_P`) shift tidiness, comfort and wealth and lean the hobbies, likes and yards: Frankish and
Byzantine households to drapes and banners, Anglo-Saxon and East Asian ones to the sill and gardens, Saami and steppe
ones to rugs and pelts with few drapes, Dwarven ones to light, shelves and crafts. Building types shift a few traits
(a temple is kept, a smithy busy). Work buildings keep the stations and props the decorator gives their type whatever
the household is like.

Where the weights go:
- Decorator (`decorate.js` `fill`): each extra's odds times `extraWeights` (trophies by collecting, tools by crafts,
  chart by maps, seating by size and games, banners by taste and wealth, and so on); the fill target times `fillShare`.
- Interior library (`kitbash.js`): each assembly's weight times `kitWeight` (rugs, banners, food, candles, storage,
  pots, item stands, drapes against sill, couch, cabinet, bath, kitchen, dining by what the household likes); the budget
  times `kitBudget`; the wall passes by `wallWeights`, `wallGap`, `wallSkip` and `torchGap`; under the stairs by
  `underStair`; the d3 vignettes by size, clutter and collecting; the canopy bed by wealth.
- Item stands: `dressStands` (above).
- For the room layout planner (feat/layout): `persona.tidy`, `persona.clutter` (0.65 untidy plus 0.35 busy),
  `persona.size`, `persona.comfort` and `persona.likes` are on `design.request.household` and on every context the
  furnishing gets (`ctx.persona`).

Role props are left to the game (D-074): a resident adds one or two touches from their own role when they decorate,
as a role display fitted to a free spot. In every home, sleeping, guest, hall and kitchen room `kitbash.js`
`residentSlots` marks candidate spots, each wall spot tested as a wall item stand would be: a wall bay by the bed, by
the hearth and by the way in, a shelf spot, and up to three table tops. They go to `design.slots` as
`{ kind: 'bed' | 'hearth' | 'door' | 'shelf' | 'table', role, x, y, z, yaw, free }`, where `free` is the space measured
there: for a wall spot `width` (plain wall clear of anything at 1.0 to 2.4 m, in 0.25 m steps up to 3.25 m), `depth`
(clear floor in front, up to 1.5 m) and `height`; for a table `area` (m2 of top with nothing on it) and `share`.
Nothing is placed there. `kitbash.js` `ROLE_DISPLAYS` holds role displays as data, never placed by the generator: a
shield and a weapon, two trophies, three tools, a hoe and cultivator, a ledge with herbs and food over a pot, the
spice rack and pots, tools or a meal on a table corner, a fishing rod over a fish. Each has the library's format, the
roles it suits (`roles`) and what it needs from a slot (`need`: width, depth, area); the mod picks one that fits and runs
the same fit tests before placing it piece by piece.

### Handoff (2026-11-09)

Done, on feat/persona: households (`lib/persona.js`), persona-weighted wall passes, under-stair choice, kit weights,
item stands with items, resident slots with measured free space and role displays as data (D-074), the lived-in pass,
hobby and habit kits, additive decor stages with the same structure at every stage (D-071), working yards and
household yards (D-067). Checks on the final code: check_set 225, 90 and 147 of 147 pass; test_structure 36;
check_interiors as main's baseline (bareFloors 7, beds 1, stairs 2 of 4); gen-test 5 of 5 byte for byte;
`lab/stages.js` d1 in d2 and d2 in d3 both 100 %; the lead's nine Norse Meadows lines at tries 1 are file supersets
d1 in d2 in d3 at s1 to s3.

Half done: the d2 to d3 split puts most pieces at d2 (a Meadows s3 home: 6, 90, 107 decor pieces); the decorator's
own d3 branches (`decorate.js` `furnishPlan`) are tagged 2 by default. Working yards fit about two buildings in three
(smithy 8 of 12, workshop 8 of 12, woodworker 3 of 12: open sides and gates crossing runs); the forge cooler and tool
rack rarely find room. Window kits (drapes, sill pots) seldom fit next to octagon corners and log corner posts.

Next: tag the d3-only branches of `furnishPlan` as stage 3 so d2 sits nearer the corpus d2 rate; tune the work yards'
spots; give the mod `design.slots` and `ROLE_DISPLAYS` (in the bundle already) for residents' role touches.

### Lived in (D-068)

Messy realism, after the library (`kitbash.js` `liveIn`, d2 and d3): rugs turn up to 9 degrees and shift up to 14 cm,
chairs and stools up to 24 degrees and 12 cm, benches 5 degrees, barrels and pots any way, crates 10 degrees, and the
dishes, candles and mugs on a table up to 45 degrees and 7 cm; all of it times 0.12 to 1 by the household's clutter,
and a tidy household leaves most things square (a piece moves with odds 0.3 + 0.7 times clutter). Beds, doors,
stations, tables, chests, anything hung or built, and anything with something standing on it stay put. A move stands
only when it makes no new problem for that piece (solids clipping past their marks, the audit's overlap, a doorway or a
stair's way, a kept-clear place, off its floor or table, out of its room); otherwise half the move is tried, then none.
Each piece draws from a stream seeded by its own place, so it moves the same way at every decor stage.

What lies about, by hobbies and habits (built kits weighed by `kitWeight`): pots by a window and a cluster of pots in a
corner (plants), a half-done project (the chopping block with timber lying by it, a crate, a tool on the wall over it)
and a tanning rack with a hide before it (crafts), a pelt half under the bed (comfort, rugs), a table left as it was
used with dishes, a jug, a mug and a candle turned every way (clutter, food) or kept clear with a candle and a jug in the
middle (tidy), a corner of a crate, a barrel and a pot (busy and untidy). Station extensions stand indoors as decor;
no base station is added.

### Decor stages (D-071)

A household decorates over time, and in the game a resident decorates their own home: d1 is what it moves in with, d2
and d3 add to it. The generator furnishes every design at d3 and tags each piece with the stage it goes up in (`p.ds`):
the passes that know tag their own (the decorator's fill past the d2 rate, the library's assemblies past the d2 budget,
every other piece on a wall and the high shelf, the vignettes, the canopy bed, back-door lights, the yard's lamp,
bushes, flowers and scarecrow: 3; dining sets, the building's own kits, under the stairs, front-door lights, the lean-to's
goods, the yard's beds, firewood, bench and work things: 2). `persona.js` `growth` tags the rest: d1's essentials (beds,
two chests, the fire and what cooks on it, the forge and workbench, the smelter; in a tavern or longhouse also two
tables and their seats, in a temple its altar and what stands on it; a building with none of these its first two pieces
of furniture) at 1, anything else at 2; an assembly goes up at the latest of its pieces, and a thing never before the
table, chest, seat, station or built furniture it stands on. An asked d1 or d2 keeps the pieces of that stage and
those before it. `lib/request.js` `best` ranks seeds on the bare d3 structure and checks the d3 design, then cuts the
asked stage from the chosen seed, so d1, d2 and d3 of one request take the same seed. The building and its
yard fence are the same at every decor stage (before, the structure of the same seed differed between d1 and d3 in 68
of 80 requests: shutters, galleries, partitions and yard fences followed the decor). `req.stages: false` furnishes at
the asked stage alone, the old way.

Measured with `node lab/stages.js lib 2` (192 requests, twelve types, four biomes, s2 and s3, the same seed at d1, d2
and d3; a piece counts when the same prefab stands in the same place within 5 cm, turned the same within 3 degrees):

| | Before | After |
|---|---|---|
| d1 pieces kept in d2 | 34 % (413 of 1,230) | 100 % (735 of 735) |
| d2 pieces kept in d3 | 59 % (4,006 of 6,822) | 100 % (6,837 of 6,837) |

## Repair

How a repair is chosen, in order of trust:

1. Gaps in a row: a run of the same piece at the same height and turn with exactly one piece missing, where the row
   above or below has that piece. Roofs use the rows up and down the slope.
2. Gaps in a stack: one course missing between the same piece above and below, with the same piece beside it.
3. Holes in a floor: a floor cell with floor on all four sides (three sides at lower confidence).
4. Mirror: every line across both axes in 0.5 m steps is tried; the score is the share of pieces whose mirror exists,
   counted only where the mirror would still lie inside the build. A mirror is used at 86 % or more. Mirrored pieces
   must touch at least three existing pieces.
5. Patterns: for each kind of piece, neighbours it has in at least 85 % of its five or more copies in this build.
   A candidate needs two such votes.

Measured on test damage (pieces removed at random or a slice cut from one side, then repaired):

| Test | Builds | Found again | Right among those added |
|---|---|---|---|
| Random 3 % removed | corpus houses | 19 % | 31 % |
| Random 3 % removed | generated | 58 % | 36 % |
| 30 % of one side cut | corpus houses | 6 % | 54 % |
| 30 % of one side cut | generated | 29 % | 63 % |

Most hand builds are too irregular for the mirror rule (24 of 94 test houses read as mirrored). Added pieces show in
teal and the page lists them by rule, so they can be checked before the file goes into the game. The confidence slider
and the rule switches trade how much is filled against how much is right.

## Pool audit (the gate)

`lib/audit.js` measures a folder of designs against the defects found in game tests. It runs in Node
(`lab/audit_pool.js <folder> [--json out] [--list] [--gate]`) and in the game's bundle (`vhAudit`), so the lab and the
game judge a pool the same way. A test pool's files are read as lines (`<culture>-<line>_s#d#`); any other file alone.

| Measure | Gated | What it catches |
|---|---|---|
| nestBroken | yes | a piece of d1 missing from d2, or of d2 from d3 (D-071) |
| furnClip, stacked | yes | furniture inside furniture; furniture on furniture other than chest stacks and table settings |
| overWin | yes | something hung over a window or door |
| stairFoot, stations | yes | a stair with nothing under its foot; a base station with no roof (D-067) |
| mountClip | yes | a sign, stand or carving more than 1.5 cm (a banner's cloth 3 cm) into what shows of a wall, post, beam or roof (the 2x2 wood wall's cross bars stand 13 cm proud of its collider; T-606, T-612) |
| hang | yes | a banner's cloth into the floor or the roof, or its foot more than 1 m up (the purple banner, `piece_banner09`, T-606); signs and wall stands outside 1.0 to 2.3 m and 0.7 to 2.4 m |
| loose | yes | food or drink set down loose: the game drops it and a player picks it up walking past (T-626) |
| doorway | yes | anything solid in the middle 0.9 m of a door's way from 0.35 to 1.95 m, 0.7 m either side (a beam at the foot of a door, T-606) |
| onStation | yes | furniture on or in a crafting station (a table on a workbench, T-606) |
| intoWall | yes | furniture more than 15 cm into a wall, post, brace, window or door; against walls and posts by the furniture's frame (a bed's fur tucks against a wall as in the game), against braces, windows and doors by what shows of both |
| richness | yes, on pools of six lines or more | the corpus and the library slipping out of the designs: decor prefabs per d3 design (floor 11), the share of d2 and d3 decor pieces that came in a library set (0.36) and the corpus sets, mined and creative, per d3 design (0.9), from each file's `#VillheimSets` section |
| outside, intoWallSoft | watched | furniture whose middle is outside the floor's outline; furniture 5 to 15 cm into a wall |

Richness (2026-11-10). `lib/blueprint.js` writes a `#VillheimSets` section before `#Pieces` (`set id;decor pieces`, from
each piece's `kb`), which PlanBuild and the mod skip; pools written before it carry none and are not measured. The
floors (`lib/audit.js` `RICH_FLOOR`) sit a little under what the generator reaches on three pools of the nine lines:
Norse Meadows 12.2 prefabs per d3 design, 0.443 of decor from sets, 1.07 corpus sets per d3 design; norse-forest Black
Forest 14, 0.455, 1.78; middle-eastern Plains 13.4, 0.397, 1.08. A single line ranges too widely to gate (a barn holds
no corpus set, a smithy six prefabs). `node lab/make_testpool.js <out> --sample` writes the Norse Meadows pool and the
two others in `<out>/norse-forest` and `<out>/middle-eastern`, and gates each; `--culture` and `--biome` write one
other pool. All three pass since 2026-11-10 (they failed on Black Forest mountClip 6, hang 9, intoWall 3 and Plains
mountClip 3, hang 3, doorway 6, intoWall 6). The causes, fixed in the generator: an outside wall banner chosen before
the wall bands were laid ran into a band and hung with its foot 1.1 m up (`details.js` `commitMotifs` now tests lamps,
banners, signs and carvings again against the structure as it stands, and a banner's foot against the ground or floor
under it, and drops the motif round one that fails); a farm or barn with nothing at d1 opened with a built kit, whose
chest is set into its half wall (`persona.js` `stageOf` now takes no built kit for that); the well of a narrow U-plan
yard put its barrel 0.57 m into a wing wall (`generate.js`); the yard's stone paving, laid level with the floor inside,
stood half a metre into a fence gate's way (`yards.js`).

Built furniture (a cabinet whose back is a half wall) is left out of the wall measures: only pieces already in the
stage's d1 file count as the building. In the game the pool is made in `BepInEx/config/Villheim/testpool-staging-<culture>`
and moved into the blueprints folder only when the audit passes; `vh testpool make ... force` moves it anyway.

The furnishing keeps to the same lines as it places (`lib/decorate.js` `showsInto`, `hungInto`, `clearOfRelief`;
`lib/kitbash.js`; the wall motifs in `lib/motifs.js`). A hung piece keeps its collider against the wall's, which is
what holds it up in the game: it takes a height between the bars within 0.4 m, or that spot is not used. Sets that
stand on the floor move out by the face's relief; what hangs in a set goes back to the wall's collider. Banners hang
where 3 m of cloth fits with its foot under a meter; a gable banner over a wall with deeper relief than its cloth
can lie against is left out. Kit food and drink go on flat item stands whose item the household picks; a kit's source
clip holds only for its own pieces, never a substitute.

## Richness: how much of the corpus and the library gets in

Tyler's question (2026-11-10): what can be done to get as much as fits from the corpus and the interior library into
the designs. `node lab/richness.js [--seeds n] [--quick] [--json out] [--list]` generates home, longhouse, tavern,
smithy, workshop and storage in Meadows, Black Forest, Swamp, Mountain, Plains and Mistlands at s1d3, s2d3 and s3d3,
two seeds each (216 designs, no yards), and reports the distinct decor prefabs, the share of decor pieces from mined
sets (`kb` 'KB-'), hand-made kits ('BK-') and the decorator's own rules, the distinct mined sets placed, the share of
the 16 most used prefabs, the same per biome and stage, and why the library turned sets down (`kitbash.js` `WHY_B`,
one count per set that no anchor in a room took; `setStats` turns the count on).

| | Prefabs | Mined | Creative | Hand-made | Decorator | Mined sets | Creative sets | Top 16 | Meadows prefabs |
|---|---|---|---|---|---|---|---|---|---|
| Baseline (5277c77) | 80 | 2.6 % | | 40.1 % | 57.3 % | 58 | | 80.7 % | 27 |
| Ceilings by solids (77452c3) | 79 | 3.0 % | | 40.6 % | 56.4 % | 64 | | 81.5 % | 28 |
| Creative sets merged (5e7588a) | 95 | 2.1 % | 3.7 % | 38.3 % | 55.9 % | 43 | 48 | 81.2 % | 37 |
| Library first | 106 | 3.5 % | 7.6 % | 41.6 % | 47.3 % | 75 | 57 | 80.3 % | 44 |

Baseline refusals of mined sets (95 placed, 2,005 turned down): a clip with something placed (417, mostly the
decorator's own furniture), the audit's rest and visible-clip tests (367), over the ceiling (315), no prefab of the
slot in the biome's reach (166), tall in front of a window (124), one kind only (114). Hand-made kits: 523 placed,
1,475 turned down; clips (316) and no prefab in reach (298) lead.

Ceilings (2026-11-10). The storey is 3 m already (`generate.js` `MIN_STOREY`, a 2 m wall course and a 1 m half wall;
2.5 m for sunken huts). The low ceilings came from how rooms were read: `decorate.js` `roomModel` took a cell's
ceiling from the bounding box of what is over it, and a 45 degree roof piece's box reaches a metre below its slab, so
every room under a sloped roof had a ceiling 1.8 to 2.0 m over the floor along its eaves walls. Cells now take the
lowest underside of the game's solids over their middle and four corners (pieces with no solids keep the box); a
cell counts as covered when something is over its middle, as before. Eaves walls now read 2.6 to 2.7 m (the wall
plate). Refusals for the ceiling went from 315 to 156; the decorator also stacks more chests where it now sees room.
Taller storeys were measured on the s3d3 sample (72 designs): 3.5 m gave 75 prefabs and 4.3 % mined, 4 m 82 and
5.1 %, against 69 and 3.3 % at 3 m. The sets still turned down for the ceiling hang their torches and stands at 3 to
4 m in their source builds (tall halls). That gain is small next to the clips with the decorator's furniture, so the
storey stays 3 m; hung pieces slide down instead (below).

Library first (2026-11-10). The decorator still lays each room's essentials and its layout (`furnishPlan`, the room
templates); what its extras pass adds (`fill`, at d2 and d3) is marked `p.extra` (never written to the file). Every
set of the library, mined, creative or hand-made, may move extras out of its way (six at most, a dining set fourteen),
with whatever stood on them, and their floor counts as free again; a hand-made kit may also move up to two of the
decorator's chests, seats and lights, as before. So the sets come before the rule-based extras and the extras keep
what the sets leave. Other changes in the same pass:
- Wall, corner and window sets take their spots by the room's layout plan (`layout.js` `bias`) for what the set mostly
  is (`kitbash.js` `setKind`: storage, a bench, a station, a table), with the stream's noise; free-floor sets as before.
- A hung piece that meets the ceiling or the wall's own relief slides up or down the wall (the set's last slide
  first, so a pair stays level; never under 0.9 m; building pieces stay put).
- A floor set may stand wholly on a raised section (the benches along the walls of Norse homes), all its floor pieces
  on the same level.
- Furniture is kept out of other furniture the way the pool audit measures it (`decorate.js` `furnClash`, refusal 31;
  the decorator's extras move aside), and a building piece of a set must touch the structure that holds it.
- Hung pieces are kept out of what shows of every wall the pool audit counts, and the furnishing tests a piece set on
  its pivot (a quarter wall) where it will stand after `generate.js` `finish` (`decorate.js` `asBuilt`).
- More tries per room (40 picks, 12 misses in a row).
- `generate.js` `biomeSafe` never swaps or removes decor for its biome (D-065); it had swapped a fitted log bench for a
  plank bench that went into the couch's half wall.

In the rooms people live in (home, sleeping, guest, kitchen, hall, tavern) the extras' barrels are one group in a
corner by the fire or in the kitchen, two or three by the household, and its chests go by a bed or in a corner away
from the other chests; a bench goes by the fire, a table or under a window, weighed by the household (comfort, size,
the sill). Store and work rooms keep their rows. A Swamp house for six households had rows of barrels along most
walls, turned every way by the lived-in pass, which read as filler (2026-11-10).

Engine time (2026-11-10): the solids of a piece (`shapes.js` `world`) and its box (`checks.js` `aabb`) are kept per
piece object while its name, place, turn and scale stay the same (four calls in five were repeats); `motifs.js`
`classOf` is kept per name; `kitbash.js` `placeable` reads what lies round a piece once; a set whose core piece has no
prefab in reach skips its spots (their coin flips still drawn). Designs come out byte for byte the same; node time on
a 32-design sample 8 to 12 % less.

Measured over the sample: decor pieces per design 41 to 45, mined sets placed 43 to 75, creative sets 48 to 57, the
decorator's own share 55.9 % to 47.3 %, prefabs 95 to 106 (Meadows 37 to 44). Costs: node time per design about 30 %
more; test_variance at s2d2 a little closer (home-a 0.59 to 0.61, hall 0.58 to 0.60, home-c 0.62 to 0.66; about
half of it from the biomeSafe change).

## One table of piece sizes

Furniture and decor take their size from the game's models (`data/piece-models.json` through `lib/mesh.js` `dims`):
the footprint by what is solid, the height by what shows (a bed's frame is 0.4 m, its fur 0.68 m; a spit's legs
reach the ground under a collider that floats). `lib/pieces.js` uses it for every piece that is not structural (walls,
floors, roofs, beams and posts keep the sizes the generator's 2 m grid is built on). The decorator's table keeps the
corpus size where it is within 10 cm of the model; where it reserved more round a piece (a torch's keep-clear, a
table setting's place) the extra is `pad`, never less than the body and never behind a piece set against a wall.
`node lab/test_sizes.js [--list]` fails when either table is more than 10 cm off a model.


## In the game

The game runs the lab's own JavaScript, so `vh gen` makes the same building as the lab for the same request and seed.

| Command | What it does |
|---|---|
| `vh gen <biome> <type> <stage> [culture] ["request"] [seed]` | Best of `GenCandidates` seeds (8; config section "4b - Generator"), built at once in front of you with the ground levelled, as `vh preview` does. Saved with a short name, `gen-<number>-<culture>-<type>.blueprint` (gen-12-norse-home), in `inspiration/generated/ingame` under PlanBuild's save folder. That folder comes from `marcopogo.PlanBuild.cfg` ([Directories] "Save directory", relative to valheim.exe; the search folder when the save folder is outside it), so PlanBuild finds it with r2modman too. The file's category is Villheim, so PlanBuild lists it on its own tab; its description holds the request, and `#Design:` the lab's long design name. PlanBuild is told about the new file while the game runs; if that fails it lists it after a restart. Prints the name, plan, roof, walls, culture, piece count, checks passed and any failed check. Without a seed it takes a new one each time. |
| `vh gen list` | The last 10 `vh gen` designs by short name, with time and long design name. |
| `vh gen help` | Codes and examples. |
| `vh ask <biome> <type> <stage> [culture] "request" [seed]` | Adds one line to `BepInEx/config/Villheim/requests/requests.jsonl`: id (R-0001 on), time, world, position, facing, biome code, type, stage, culture, request, seed (0: none), status "open". Works without the generator. |
| `vh asks` | Every request, its status and its result. |
| `vh place <R-0001\|short name\|last> [here]` | Builds a request's result (`.../inspiration/generated/requests/<id>.blueprint`) or a `vh gen` design in front of you (`last` is the newest; `gen-12` alone works too; older long names in the profile's folder still work). With `here`, a request is built where you stood when you asked. `vh preview` takes the same names. |

Codes. Biomes: md Meadows, bf Black Forest, sw Swamp, mt Mountains, pl Plains, ml Mistlands, al Ashlands, dn Deep
North (the lab has no Deep North kit yet, so it builds with the Mountain kit and says so). Types: home (house),
longhouse (hall), tavern, smithy, sawmill, workshop, barn, farm, storage, tower, dock, stall, temple, well, camp. The
lab has no hub or hearth design. Stage: s1 to s3 with d1 to d3 (`s1d3`); `s2` alone is d2. Cultures: the keys in
`lib/styles.js` (`vh gen help` and `vh cultures` list them); without one the biome's cultures are picked by weight.
The console splits on spaces and keeps the quotes, so the command joins the words back together; a last whole number
is the seed.

Villages never build from `inspiration` folders, so nothing made here reaches a village. PlanBuild lists the files.
`vh preview <name>` builds them too, wells and small camps included.

### How the game runs the lab

- `lib/build_engine.js` bundles `pieces`, `styles`, `blueprint`, `checks`, `features`, `decorate`, `generate` and
  `request` with `data/rules-lite.json` and `data/scorer.json` into `src/Villheim.Logic/Generator/lab.js`, leaving
  out the drawing code. It is built into `Villheim.Logic.dll` as a resource, so it reloads with the logic.
- `src/Villheim.Logic/Generator/LabEngine.cs` runs it in Jint 4.17 (a JavaScript interpreter in C#) on a worker thread;
  `GenCommands.cs` builds the result on the game's thread. The first `vh gen` after a load reads the bundle (under a
  second); a request takes one to two seconds at best of 8 outside the game.
- Jint ships as three DLLs next to Villheim's: `Jint.dll`, `Acornima.dll` (its parser) and
  `System.Runtime.CompilerServices.Unsafe.dll`, all the netstandard2.1 builds (Unity's Mono has netstandard 2.1, so
  they need nothing else). The logic DLL is loaded from bytes, so the runtime finds them through BepInEx's resolver
  (it searches the plugins folder) or through `LabEngine.Prepare`, which looks next to `Villheim.dll`. Windows locks
  them once loaded: the updater and `scripts/deploy.ps1` replace them only when they changed, and after Valheim closes
  when they are in use.
- The packages come from nuget.org: `Villheim.Logic.csproj` downloads Jint, Acornima and Unsafe, references the
  netstandard2.1 DLLs by path and copies them to the output folder. `scripts/build-cloud.sh` fetches them the same
  way. CI rebuilds `lab.js` before building (with a warning if the committed copy was out of date) and puts the three
  DLLs in the package and the "Latest test build" release; `scripts/Villheim-Updater.ps1` installs them.
- After any change to the lab, run `node lib/build_engine.js` and commit `lab.js` with the change.
- Engines differ in one way that matters here: a sort whose comparator draws random numbers gives a different order in
  each engine. `decorate.js` used one to shuffle furniture slots; it now draws one number per slot and sorts by it.
  This changed the furniture of designs made before 2026-11-08 night for the same seed.

### Proof outside the game

`tools/gen-test/run.sh [requests.txt] [tries]` bundles the lab, runs the mod's own `LabEngine.cs` and `lab.js` in a
.NET 8 console with the shipped netstandard2.1 DLLs, then `lab/compare_engine.js` makes the same requests in node and
compares the `.blueprint` files byte for byte. Lists: `tools/gen-test/requests.txt` (5 requests) and
`requests-all.txt` (62: every type, every biome code, the request word groups, twelve cultures). On 2026-11-08 all 62
were the same byte for byte. The game runs Unity's Mono, whose maths library may differ from .NET 8's in the last
digit; positions are rounded to 3 decimals, so this is unlikely to show, but only a test in the game proves it.

### Requests for Claude

`vh ask` saves a request; Claude makes it with more care on the PC's files:

```
node lab/process_requests.js "<profile>/BepInEx/config/Villheim/requests/requests.jsonl" [result dir] [--tries 24] [--only R-0003] [--redo]
```

For every open request it builds the best of 24 seeds (checks, then score), writes `<id>.blueprint` and a four-view
`<id>.png` to `BepInEx/config/PlanBuild/blueprints/inspiration/generated/requests/` (found from the requests file's
place unless given), and marks the line `"status":"done"` with `result` (the design's name), `file`, `done` and `note`
(failed checks, or plan, roof, walls and pieces). A request it cannot make (unknown type, the hub) is marked
`"failed"` with the reason. Every other line is left as it was. A request without a seed gets one from its number, so
running it again makes the same design. Then `vh place <id>` in the game.

## Rules

- CLAUDE.md still says "existing designs and assets only". Generated designs are approved in principle (Tyler,
  2026-11-08) with controls still to agree, so they are kept apart: `Downloads\Villheim-generated\` on Tyler's PC and
  the Generated tab of the review sheet. Villages never build them. Villheim reads every blueprint under PlanBuild's
  folder, so do not copy generated designs there unless they sit under a folder named `inspiration` (which villages
  skip) and the gallery numbering is ready for them.
- Proposed wording for CLAUDE.md once Tyler agrees: "Generated designs from the blueprint lab may be built by villages
  once Tyler has marked them Yes in the Generated tab and they are copied to `blueprints/approved-generated`. They use
  only vanilla pieces and pass every check in `lib/checks.js`."
- Decor in any biome (D-065, D-126; Tyler, 2026-11-10: "there are no restrictions on any level of furniture, decoration, or
  limits on whats shown for any decor... decor can be freely used across any biome, but build pieces (walls, roofs,
  etc.) should (mostly) come from the relevant biome and surrounding biomes ... Please ensure there are not limitations
  on the number of rugs, flowers, or truly any type or quantity of decor"). Every furniture, decor, light, rug, station
  and stand item of vanilla Valheim goes in every biome, inside and out; building pieces (walls, floors, roofs, beams,
  posts, doors, windows, stairs) keep to the village's biome, the earlier ones and the next (`lib/pieces.js`
  `decorOk`, `buildReach`); D-012 (stone later in the Meadows and the Black Forest) is unchanged. D-080 is about payment
  only (the mod pays decor in local stand-ins, DecorPaidWithAnalogs). The village's own biome weighs a little more for
  flavor (`decorate.js` `flavorD`, `kitbash.js` `flavorB`: a piece or set two biomes or more ahead weighs less), never
  excludes. No decor kind or amount is held to a count: the decorator's extras halve their weight with each use in a
  room, the library's sets weigh less with each repeat in a building, and the room's free floor, the corpus rate for the
  room kind and the household set the amount.
- The BiomeBlueprints pack stays blacklisted. Only the 12 builds by other creators listed in `Keepers.cs` are read.
- Other creators' builds are study material. They are not committed to the repo and not shipped.

## Limits

- The checks, the decorator and the generator still use the catalog sizes in `lib/pieces.js`, which come from names and
  corpus measurements; the pictures use the measured models. Where the two differ by more than 10 cm:
  `docs/PIECE_SIZES.md`. An in-game export of each piece's
  collider would make them exact.
- Crop fields need the ground cultivated in game for crops to grow back.
- Furniture sizes in the decorator are measured in the corpus (`docs/INTERIOR_DESIGN.md`); the renderer still draws
  the sizes in `lib/pieces.js`.
- The first designs were placed in the game on 2026-11-09 (Tyler, T-04 to T-10); the structure rules above came from
  that review.
- `ashwood_door` pivots at its hinge side; its height is not measured, so Ashlands houses use `wood_door`.

## Commands

```
cd tools/blueprint-lab && npm install
python3 lab/build_corpus.py <corpus dir> corpus.json        # pb/, hs/, vh/, profile/, review.json
python3 lab/learn.py corpus.json [index.json] learn/
python3 lab/shapes.py corpus.json learn/catalog.csv learn/shapes.json
node lab/export_features.js corpus.json features.csv && python3 lab/train_scorer.py features.csv data/scorer.json
node lib/cli.js gen home "Black Forest" - s2 d2 7 out/house       # one design and its four views
node lib/cli.js decorate in.blueprint home d3 Swamp out/furnished  # furnish or strip (d1) a blueprint
node lib/batch.js out/shapes shapes                                # plan and roof matrix with an overview image
node lib/gen_set.js out/set 8                                      # the review set
node lab/check_set.js 8 --list                                     # every check on the review set and culture samples
node lib/gen_cultures.js out/cultures 6 ../../docs/cultures       # culture samples and overview pictures
node lib/build_web.js web/index.html                               # the request page
node lib/cli.js plan <in.blueprint> <out.png> [ppm] [cut] [x0 x1 z0 z1]   # top-down plan, optionally one room
python3 lab/extract_models.py index|run|collect ...                # piece models, on Tyler's PC only (see the script)
node lab/build_models.js <piece-models-raw.json>                    # to data/piece-models.json
node lab/piece_sizes.js                                            # catalog sizes against the game
node lib/build_engine.js                                           # the game's bundle, src/Villheim.Logic/Generator/lab.js
python3 lab/learn_interior.py <corpus dir> data/interior.json      # interior rules; then node lab/interior_lite.js
node lab/check_interiors.js lib out.json 3                         # furniture checks over a sample
node lab/creative_sets.js && node lab/creative_fit.js 2            # the creative sets into the library; how often each goes in
node lab/make_testpool.js <out> [--no-gate]                        # the Norse Meadows test pool, audited (exit 1 on a defect)
node lab/audit_pool.js <folder> [--list] [--gate]                  # the pool audit on any folder of blueprints
node lab/test_sizes.js [--list]                                    # decorator and catalog sizes against the models
node lab/test_variance.js                                          # one house, six households: under 0.6 alike
node -e "require('./lib/floorplan.js').set(24)"                   # the floorplan catalog ('vh floorplan set' in the game)
node lab/floorplan_feedback.js floorplans.csv                      # Tyler's Floorplans tab into the fill rates
node lab/process_requests.js <requests.jsonl> [result dir]         # make the designs asked for with 'vh ask'
../gen-test/run.sh [list] [tries]                                  # game engine and node, byte for byte
```
