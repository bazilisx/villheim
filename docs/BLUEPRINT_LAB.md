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
| Checks | `lib/checks.js`, `lab/check_set.js` | Every piece connected to the ground, no doubled pieces, doors you can walk through, headroom under roofs and ceilings, ladders and stairs you can climb, no woodpiles indoors, materials the biome has (furnishing too), floor left free. See "Structure rules". |
| Renderer | `lib/render.js`, `lib/sheet.js` | Four views (front left, back right, top, inside with the roof off) as PNG in Node or on a canvas in a browser. |
| Request page | `web/app.html`, built to `web/index.html` by `lib/build_web.js` | Type or pick a request, get the best of up to 16 candidates, turn it round, download the `.blueprint`; a second tab strips or furnishes an uploaded blueprint; a third repairs one. Published as the artifact "Villheim Blueprint Lab"; a copy is in `BepInEx/config/Villheim-tools/` on Tyler's PC and opens offline. |
| Requests | `lib/request.js` | Request words to choices, the best of several seeds, and one request made from short codes. Shared by the page, the game (`vh gen`) and `lab/process_requests.js`. |
| Game bundle | `lib/build_engine.js` to `src/Villheim.Logic/Generator/lab.js` | The generator for the game, run by Jint. See "In the game". |
| Repair | `lib/repair.js`, tests `lab/test_repair.js` and `lab/test_repair_chunk.js` | Fills in pieces missing from an uploaded blueprint from the rest of the build: gaps in a row, a missing course in a stack, holes in a floor, the mirror of the other half when the build is mostly symmetric, and pieces that the build's own patterns call for. Each added piece carries a reason and a confidence. Third tab of the request page. |
| Millénaire study | `lab/mc_convert.py`, `lab/mc_eval.js`, `lab/mc_render.js`, `lab/mc_compare.py`, `data/mc-blockmap.json` | Translates Millénaire schematics into blueprints for study and measures how well they translate. Kept apart from the lab's data; see `docs/MC_TRANSLATION.md`. |
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
| Doors can be walked through | The door piece fits the wall: `wood_door` for a 2 m opening, `piece_cloth_hanging_door` for a 3 m one, `wood_gate` for barns (3 m); never `darkwood_gate`. Roof, eave and beam pieces in a doorway, or lower than 2.3 m for a metre in front of it or behind it, are taken out (the eave is cut back over the door). A raised door gets a stair: from the ground at 2 m, set half in the ground at 1 m, stopping at the face of a stone course. | `doors`: nothing in the opening, nothing under 2.3 m for a metre either side, and a floor, stair or the ground to step on at both sides. |
| Ladders can be climbed | Each ladder needs three cells in a row: a clear foot, the hole, and a landing. Cells along a wall come first, away from the door and the chimney. The foot stands at the near edge of the hole; in a 3 m storey the climb ends in the middle of the landing cell, whose near half stays open and whose far half gets two `wood_floor_1x1`. In towers each landing is the next ladder's foot, so they climb round the walls. Furniture is kept off the foot, the hole and the landing. Flat roofs get a ladder to a hatch. | `ladders`: a metre of clear floor in front of the foot, a floor to step onto at the top, and nothing lower than 1.9 m over the climb. |
| Fires sit under the smoke | The fire goes to the middle of the smoke hole: the ridge caps left out over it, the open crown of a ring roof, or a cell of a flat roof. A chimney goes over a ridge or flat-roof hole, through any upper floor: stone where the culture may build in stone, else a plank box with a raised cap on short posts (a smoke louver). Ring roofs keep their open crown. No fire laid: the ridge is closed again. A hearth in a room under 40 m2 becomes a fire pit. | (the fire's place is set by the generator) |
| Ceiling braziers hang lit | `piece_brazierceiling01` hangs on its 2 m chain from the lowest roof or ceiling piece over the middle of its room (two in a hall are spread along it), at least 2.3 m up and away from the fire; where the room is too low it stands as a torch. The spawner lights every fire, brazier and torch a design brings and keeps it lit (`DesignSpawner.KeepLitPatch`). | |
| Woodpiles outside | Woodpiles placed indoors move outside against an outside wall, away from the doors, or are left out. | `woodpiles`: none under a roof inside walls. |
| Materials by biome | Dark wood takes tar (Plains): the Swamp kit is wood and iron; dark roofs, frames and porch roofs start in the Plains. Furnishing the biome cannot make comes out; the generator's own props (well and pen barrels, camp benches) are swapped for ones it can. | `materials`: every piece, structure and furnishing, by `pieces.js` `needs`. |
| Floors in the ground | A 1 m stone floor sits half in the ground. Posts and stilts start a metre in the ground. The game sets a design's lowest pivot on the ground, so both keep fields, wells and pens on the ground too. In the game, `DesignSpawner.SpawnEntry` paints dirt under every floor that rests on the ground before placing it and levels the earth: just under a thin floor, and up to 0.15 m under the top of a stone floor. This runs for `vh preview`, `vh gen`, `vh place` and village builds. | |

Measured pivots (corpus neighbours, `pieces.js` `DOORS` and `CLIMB`): `wood_door` pivots in its middle (2 x 2 m);
`wood_gate` 1 m above its bottom (2 m wide, 3 m tall); `darkwood_gate` on its bottom (4 m tall);
`piece_cloth_hanging_door` hangs from its pivot at the top of a 3 m opening, turned 90 degrees against its wall and
0.3 m to one side of it; `wood_stepladder` stands on its pivot and climbs 2 m over 2 m toward its local -z;
`wood_stair` pivots in its middle and climbs the same way; `piece_brazierceiling01` hangs about 2 m below what it
hangs from.

`node lab/check_set.js [tries] [--gen <lib dir>] [--list]` runs every check on the review set and the culture samples
without drawing them; `--gen` makes the designs with another copy of the lib to compare. On 2026-11-09, best of 8:

| | Review set | Culture samples |
|---|---|---|
| Before (old generator, new checks) | 64 of 225 | 18 of 147 |
| After | 225 of 225 | 147 of 147 |

On single seeds (every type, seven biomes, three stages, six seeds; 1,890 designs) 484 passed every check before and
1,889 after.

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
    (`lib/request.js` `best`: seeds n, n + 101, n + 202 and so on).

A request may also name storeys (1 to 3) and ask for a porch or none. Both, and an asked roof pitch, go into the
design's name (`-2st`, `-porch`, `-noporch`, `-p45`), so two requests never share a file name. A porch is only built
where the plan has a front for one; otherwise a note says so.

Request words are read by `lib/request.js` (`read`), the same code for the page, the game and the request processor:
plan (L-shaped, T-shaped, cross, courtyard, round, long, square), roof (gable, hip, flat, shed roof, lean-to, steep,
low roof), walls (plank, half-timber, log, stone, stone base), storeys (one, two, three storeys or floors, upstairs,
loft), porch (porch, veranda, no porch), size (small, large) and decor (bare, cosy, rich), plus biome and culture
words. A culture key written among the words (`middle-eastern`) counts as the culture.

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
| `vh gen <biome> <type> <stage> [culture] ["request"] [seed]` | Best of `GenCandidates` seeds (8; config section "4b - Generator"), built at once in front of you with the ground levelled, as `vh preview` does. Saved to `BepInEx/config/PlanBuild/blueprints/inspiration/generated/ingame/<name>.blueprint` and nothing else. Prints the name, plan, roof, walls, culture, piece count, checks passed and any failed check. Without a seed it takes a new one each time. |
| `vh gen help` | Codes and examples. |
| `vh ask <biome> <type> <stage> [culture] "request" [seed]` | Adds one line to `BepInEx/config/Villheim/requests/requests.jsonl`: id (R-0001 on), time, world, position, facing, biome code, type, stage, culture, request, seed (0: none), status "open". Works without the generator. |
| `vh asks` | Every request, its status and its result. |
| `vh place <R-0001\|name> [here]` | Builds a request's result (`.../inspiration/generated/requests/<id>.blueprint`) or a `vh gen` design in front of you. With `here`, a request is built where you stood when you asked. |

Codes. Biomes: md Meadows, bf Black Forest, sw Swamp, mt Mountains, pl Plains, ml Mistlands, al Ashlands, dn Deep
North (the lab has no Deep North kit yet, so it builds with the Mountain kit and says so). Types: home (house),
longhouse (hall), tavern, smithy, sawmill, workshop, barn, farm, storage, tower, dock, stall, temple, well, camp. The
lab has no hub or hearth design. Stage: s1 to s3 with d1 to d3 (`s1d3`); `s2` alone is d2. Cultures: the keys in
`lib/styles.js` (`vh gen help` and `vh cultures` list them); without one the biome's cultures are picked by weight.
The console splits on spaces and keeps the quotes, so the command joins the words back together; a last whole number
is the seed.

Villages never build from `inspiration` folders, so nothing made here reaches a village. PlanBuild lists the files.
`vh preview <name>` finds them too, except designs under 25 pieces (wells, small camps), which only `vh place <name>`
builds.

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

- Piece sizes come from names and corpus measurements, so the pictures are close. An in-game export of each piece's
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
node lib/build_engine.js                                           # the game's bundle, src/Villheim.Logic/Generator/lab.js
python3 lab/learn_interior.py <corpus dir> data/interior.json      # interior rules; then node lab/interior_lite.js
node lab/check_interiors.js lib out.json 3                         # furniture checks over a sample
node lab/process_requests.js <requests.jsonl> [result dir]         # make the designs asked for with 'vh ask'
../gen-test/run.sh [list] [tries]                                  # game engine and node, byte for byte
```
