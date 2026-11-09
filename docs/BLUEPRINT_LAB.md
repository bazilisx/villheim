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
| Checks | `lib/checks.js`, `lab/check_set.js` | Every piece connected to the ground, no doubled pieces, doors you can walk through, headroom under roofs and ceilings, ladders and stairs you can climb, no woodpiles indoors, materials the biome has (furnishing too), floor left free. See "Structure rules". |
| Renderer | `lib/render.js`, `lib/sheet.js` | Four views (front left, back right, top, inside with the roof off) and top-down room plans at a true scale, as PNG in Node or on a canvas in a browser. Each piece is drawn from its model in `data/piece-models.json`. See "Renderer". |
| Piece models | `lab/extract_models.py`, `lab/build_models.js`, `data/piece-models.json`, `lab/piece_sizes.js` | Bounds, colliders, pivot and a low-poly proxy (boxes and prisms with colors) for 682 vanilla pieces, measured from the game's prefabs on Tyler's PC. Catalog sizes against the game: `docs/PIECE_SIZES.md`. |
| Request page | `web/app.html`, built to `web/index.html` by `lib/build_web.js` | Type or pick a request, get the best of up to 16 candidates, turn it round, download the `.blueprint`; a second tab strips or furnishes an uploaded blueprint; a third repairs one. Published as the artifact "Villheim Blueprint Lab"; a copy is in `BepInEx/config/Villheim-tools/` on Tyler's PC and opens offline. |
| Requests | `lib/request.js` | Request words to choices, the best of several seeds, and one request made from short codes. Shared by the page, the game (`vh gen`) and `lab/process_requests.js`. |
| Game bundle | `lib/build_engine.js` to `src/Villheim.Logic/Generator/lab.js` | The generator for the game, run by Jint. See "In the game". |
| Repair | `lib/repair.js`, tests `lab/test_repair.js` and `lab/test_repair_chunk.js` | Fills in pieces missing from an uploaded blueprint from the rest of the build: gaps in a row, a missing course in a stack, holes in a floor, the mirror of the other half when the build is mostly symmetric, and pieces that the build's own patterns call for. Each added piece carries a reason and a confidence. Third tab of the request page. |
| Millénaire study | `lab/mc_convert.py`, `lab/mc_eval.js`, `lab/mc_render.js`, `lab/mc_compare.py`, `data/mc-blockmap.json` | Translates Millénaire schematics into blueprints for study and measures how well they translate. Kept apart from the lab's data; see `docs/MC_TRANSLATION.md`. |
| Yards | `lab/mine_yards.js`, `data/yards.json`, `lib/yards.js` | What stands outside the walls of the corpus builds (fences, gates, paths, beds, piles, lamps, carts), how far out, how fences turn and how deep pieces sit in the ground; the yard a stage 2 or 3 home or farm gets from it. See "Yards" under the component bench. |
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
`stack`, `dormer`, `bed`, `stair`, `yard`. Sheets go to a reviewer that has not seen the code; its findings become fixes and
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

### Yards

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
node -e "require('./lib/floorplan.js').set(24)"                   # the floorplan catalog ('vh floorplan set' in the game)
node lab/floorplan_feedback.js floorplans.csv                      # Tyler's Floorplans tab into the fill rates
node lab/process_requests.js <requests.jsonl> [result dir]         # make the designs asked for with 'vh ask'
../gen-test/run.sh [list] [tries]                                  # game engine and node, byte for byte
```
